const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const directory = path.resolve(process.env.SEGMENT_CACHE_FOLDER || path.join(os.homedir(), '.cache', 'nehli-segments'));
const maxBytes = 512 * 1024 * 1024;
const maxEntries = 512;
const pending = new Map();
let writes = 0;
let trimming;

async function trim() {
    const names = (await fs.readdir(directory)).filter(name => /^[a-f0-9]{64}\.ts$/.test(name));
    const entries = await Promise.all(names.map(async name => {
        const file = path.join(directory, name);
        const stat = await fs.stat(file).catch(() => undefined);
        return stat && { file, size: stat.size, time: stat.mtimeMs };
    }));
    let used = 0;
    let count = 0;
    for (const entry of entries.filter(Boolean).sort((a, b) => b.time - a.time)) {
        used += entry.size;
        if (++count > maxEntries || used > maxBytes) await fs.unlink(entry.file).catch(() => {});
    }
}

async function write(file, bytes) {
    const temporary = file + '.' + randomUUID();
    try {
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(temporary, bytes);
        await fs.rename(temporary, file);
        if (++writes === 1 || writes % 8 === 0) {
            trimming ??= trim().catch(() => {}).finally(() => { trimming = undefined; });
        }
    } catch {
        await fs.unlink(temporary).catch(() => {});
    }
}

async function load(key, res, generate, observe = () => {}) {
    const name = createHash('sha256').update('hls-v1:' + key).digest('hex') + '.ts';
    const file = path.join(directory, name);
    const cached = await fs.readFile(file).catch(() => undefined);
    if (cached?.length) {
        observe('hit');
        return cached;
    }
    if (res.destroyed) return;

    let job = pending.get(key);
    if (job) observe('shared');
    if (!job) {
        const controller = new AbortController();
        job = { controller, readers: 0 };
        const current = job;
        job.output = Promise.resolve().then(async () => {
            const saved = await fs.readFile(file).catch(() => undefined);
            if (saved?.length) {
                observe('hit');
                return saved;
            }
            observe('generated');
            controller.signal.throwIfAborted();
            const bytes = await generate(controller.signal);
            await write(file, bytes);
            return bytes;
        }).finally(() => {
            if (pending.get(key) === current) pending.delete(key);
        });
        pending.set(key, job);
    }

    job.readers++;
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        if (--job.readers !== 0 || pending.get(key) !== job) return;
        pending.delete(key);
        job.controller.abort();
    };
    res.once('close', release);
    try {
        return await job.output;
    } finally {
        release();
        res.off('close', release);
    }
}

module.exports = { load };
