const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomUUID } = require('node:crypto');

const directory = path.resolve(process.env.METADATA_OVERRIDE_FOLDER || path.join(os.homedir(), '.local', 'share', 'nehli', 'metadata'));
const maxImageBytes = 700 * 1024;

function filename(category, title) {
    const key = createHash('sha256').update(JSON.stringify([category, title])).digest('hex');
    return path.join(directory, key + '.json');
}

async function read(category, title) {
    try {
        return JSON.parse(await fs.readFile(filename(category, title), 'utf8'));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return {};
    }
}

async function write(category, title, value) {
    const target = filename(category, title);
    const temporary = target + '.' + randomUUID();
    await fs.mkdir(directory, { recursive: true });
    try {
        await fs.writeFile(temporary, JSON.stringify(value), { flag: 'wx' });
        await fs.rename(temporary, target);
    } finally {
        await fs.unlink(temporary).catch(() => {});
    }
}

function decodeImage(value) {
    if (typeof value !== 'string' || value.length > Math.ceil(maxImageBytes / 3) * 4) return;
    const bytes = Buffer.from(value, 'base64');
    if (bytes.length > maxImageBytes || bytes.length < 12 || bytes.toString('base64') !== value) return;
    if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { bytes, mime: 'image/jpeg' };
    if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { bytes, mime: 'image/png' };
    if (/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) return { bytes, mime: 'image/gif' };
    if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { bytes, mime: 'image/webp' };
}

module.exports = { read, write, decodeImage };
