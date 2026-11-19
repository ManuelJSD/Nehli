const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const directory = path.resolve(process.env.METADATA_CACHE_FOLDER || path.join(os.homedir(), '.cache', 'nehli-metadata'));
const limits = { json: 512, jpg: 256, cover: 256 };
const maxBytes = 2 * 1024 * 1024;
const pending = new Map();
let writes = 0;

function cacheFile(type, key) {
    return path.join(directory, createHash('sha256').update(key).digest('hex') + '.' + type);
}

async function read(type, key, maxAge = Infinity) {
    try {
        const file = cacheFile(type, key);
        const stat = await fs.stat(file);
        if (stat.size > maxBytes || Date.now() - stat.mtimeMs >= maxAge) return undefined;
        return await fs.readFile(file);
    } catch {
        return undefined;
    }
}

async function trim() {
    const entries = await fs.readdir(directory);
    for (const [type, limit] of Object.entries(limits)) {
        const names = entries.filter(name => new RegExp('^[a-f0-9]{64}\\.' + type + '$').test(name));
        if (names.length <= limit) continue;
        const files = (await Promise.all(names.map(async name => {
            const file = path.join(directory, name);
            const stat = await fs.stat(file).catch(() => undefined);
            return stat && { file, time: stat.mtimeMs };
        }))).filter(Boolean).sort((a, b) => b.time - a.time);
        await Promise.all(files.slice(limit).map(({ file }) => fs.unlink(file).catch(() => {})));
    }
}

async function write(type, key, bytes) {
    if (!bytes?.length || bytes.length > maxBytes) return;
    const file = cacheFile(type, key);
    const temporary = file + '.' + randomUUID();
    try {
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(temporary, bytes);
        await fs.rename(temporary, file);
        if (++writes === 1 || writes % 32 === 0) await trim();
    } catch {
        await fs.unlink(temporary).catch(() => {});
    }
}

function load(type, key, maxAge, generate) {
    const id = type + ':' + key;
    if (pending.has(id)) return pending.get(id);
    const result = (async () => {
        const saved = await read(type, key, maxAge);
        if (saved) return saved;
        const data = await generate();
        if (data) await write(type, key, data);
        return data;
    })().finally(() => pending.delete(id));
    pending.set(id, result);
    return result;
}

let playbackUntil = 0;
let playbackRequests = 0;

function notePlayback(req, res, next) {
    playbackRequests++;
    res.once('close', () => {
        playbackRequests--;
        playbackUntil = Date.now() + 15000;
    });
    next();
}

function playbackBusy() {
    return playbackRequests > 0 || Date.now() < playbackUntil;
}

module.exports = { read, load, write, notePlayback, playbackBusy, maxBytes };
