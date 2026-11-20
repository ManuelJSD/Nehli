const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const disk = require('../utils/metadataCache');

const root = path.resolve(process.env.MUSIC_FOLDER || './musica');
const run = promisify(execFile);
const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
const containers = new Map([
    ['.mp3', 'audio/mpeg'], ['.wav', 'audio/wav'], ['.m4a', 'audio/mp4'],
    ['.flac', 'audio/flac'], ['.ogg', 'audio/ogg'], ['.opus', 'audio/ogg'],
    ['.aac', 'audio/aac'], ['.aiff', 'audio/aiff'], ['.aif', 'audio/aiff'], ['.wma', 'audio/x-ms-wma']
]);
const artTypes = new Map([['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'], ['.webp', 'image/webp']]);
const rescanInterval = 60_000;
let catalog;
let refreshing;
let nextScan = 0;
let scanFailed = false;
let activeConversions = 0;
let artworkQueue = Promise.resolve();

const hash = value => createHash('sha256').update(value).digest('hex');
const text = value => typeof value === 'string' ? value.trim().slice(0, 512) : '';
const discFolder = /^(?:cd|dis[ck]o?|vol(?:ume|umen)?)\s*[-_.]?\s*(\d+)$/i;

function isWithin(parent, filename) {
    const relative = path.relative(parent, filename);
    return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

async function localFile(filename) {
    try {
        const [base, real] = await Promise.all([fs.realpath(root), fs.realpath(filename)]);
        if (!isWithin(base, real)) return;
        const stat = await fs.stat(real);
        if (stat.isFile()) return { filename: real, stat };
    } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    }
}

async function inventory(directory, files, art) {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return; throw error; }

    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            await inventory(filename, files, art);
        } else if (entry.isFile()) {
            const { ext, name } = path.parse(entry.name);
            if (containers.has(ext.toLowerCase())) files.push(filename);
            if (artTypes.has(ext.toLowerCase()) && /^(cover|folder|front|portada)$/i.test(name)) {
                const previous = art.get(directory);
                if (!previous || entry.name.toLowerCase().startsWith('cover.')) art.set(directory, filename);
            }
        }
    }
}

async function readTrack(filename, previous) {
    const local = await localFile(filename);
    if (!local) return;
    const relative = path.relative(root, filename);
    const id = hash(relative);
    const version = local.stat.size + ':' + local.stat.mtimeMs;
    if (previous?.get(id)?.version === version) return previous.get(id);

    const name = path.basename(filename);
    const extension = path.extname(name).toLowerCase();
    const parts = path.dirname(relative).split(path.sep).filter(part => part !== '.');
    const discMatch = parts.at(-1)?.match(discFolder);
    const albumParts = discMatch ? parts.slice(0, -1) : parts;
    let probe;
    try {
        const { stdout } = await run(process.env.FFPROBE_PATH || 'ffprobe', [
            '-v', 'error', '-protocol_whitelist', 'file', '-of', 'json',
            '-show_entries', 'format=duration:format_tags:stream=index,codec_type,codec_name:stream_disposition=attached_pic',
            local.filename
        ], { windowsHide: true, timeout: 4000, maxBuffer: 512 * 1024 });
        probe = JSON.parse(stdout);
    } catch {
        // Files without readable tags still receive names from their folders and filenames.
    }

    const audio = probe?.streams?.find(stream => stream.codec_type === 'audio');
    if (probe && !audio) return;
    const tags = Object.fromEntries(Object.entries(probe?.format?.tags || {}).map(([key, value]) => [
        key.toLowerCase().replace(/[ _-]/g, ''), value
    ]));
    const album = text(tags.album) || albumParts.at(-1) || 'Sin álbum';
    const directoryArtist = albumParts.at(-2);
    const artist = text(tags.artist) || text(tags.albumartist) || directoryArtist || 'Artista desconocido';
    const albumArtist = text(tags.albumartist) || directoryArtist || artist;
    const duration = Number(probe?.format?.duration);
    const track = {
        id, filename: name, folders: parts, title: text(tags.title) || path.parse(name).name, artist,
        disc: parseInt(tags.disc, 10) || Number(discMatch?.[1]) || 1,
        number: parseInt(tags.track, 10) || Number(path.parse(name).name.match(/^(\d{1,3})[ ._-]/)?.[1]) || null,
        duration: Number.isFinite(duration) && duration > 0 ? duration : null,
        mime: containers.get(extension), codec: audio?.codec_name || null
    };

    return {
        filename, name, version, album, albumArtist,
        albumDirectory: path.join(root, ...albumParts), directory: path.dirname(filename),
        embedded: probe?.streams?.find(stream => stream.disposition?.attached_pic)?.index,
        track
    };
}

async function scan() {
    const files = [];
    const art = new Map();
    await inventory(root, files, art);
    const tracks = new Map();
    const albums = new Map();

    for (let start = 0; start < files.length; start += 2) {
        const batch = await Promise.all(files.slice(start, start + 2).map(file => readTrack(file, catalog?.tracks)));
        for (const row of batch) {
            if (!row) continue;
            tracks.set(row.track.id, row);
            const id = hash(JSON.stringify([path.relative(root, row.albumDirectory), row.album, row.albumArtist]));
            let album = albums.get(id);
            if (!album) {
                album = { id, title: row.album, artist: row.albumArtist, trackRows: [] };
                albums.set(id, album);
            }
            album.trackRows.push(row);
        }
    }

    const ordered = [...albums.values()].sort((a, b) => collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title));
    const summaries = ordered.map(album => {
        album.trackRows.sort((a, b) => a.track.disc - b.track.disc ||
            (a.track.number ?? Infinity) - (b.track.number ?? Infinity) || collator.compare(a.name, b.name));
        const first = album.trackRows[0];
        album.artwork = art.get(first.albumDirectory) || album.trackRows.map(row => art.get(row.directory)).find(Boolean);
        album.embedded = album.trackRows.find(row => row.embedded !== undefined);
        return {
            id: album.id, title: album.title, artist: album.artist,
            hasArtwork: !!(album.artwork || album.embedded), tracks: album.trackRows.map(row => row.track)
        };
    });
    return { albums, tracks, summaries };
}

function refresh() {
    if (!refreshing && Date.now() >= nextScan) {
        refreshing = scan().then(result => {
            catalog = result;
            scanFailed = false;
        }).catch(error => {
            scanFailed = true;
            console.error('No se pudo escanear la biblioteca de música:', error.code || error.name);
        }).finally(() => {
            nextScan = Date.now() + (scanFailed ? 5000 : rescanInterval);
            refreshing = undefined;
        });
    }
    return refreshing;
}

function getCatalog(req, res) {
    refresh();
    if (!catalog && scanFailed && !refreshing) return res.status(503).json({ error: 'No se pudo leer la carpeta de música.' });
    res.json({ albums: catalog?.summaries || [], scanning: !catalog });
}

async function getMusicas() {
    await refresh();
    if (!catalog && scanFailed) throw new Error('Biblioteca de música no disponible');
    return [...(catalog?.tracks.values() || [])].map(row => row.name);
}

async function sendArtwork(req, res, next) {
    try {
        const album = catalog?.albums.get(req.params.id);
        if (!album) return res.sendStatus(404);
        if (album.artwork) {
            const art = await localFile(album.artwork);
            if (art && art.stat.size <= 10 * 1024 * 1024) {
                return res.type(artTypes.get(path.extname(album.artwork).toLowerCase()))
                    .sendFile(art.filename, { cacheControl: false }, error => { if (error && !res.destroyed) next(error); });
            }
        }

        const row = album.embedded;
        if (!row) return res.sendStatus(404);
        const key = JSON.stringify(['music-artwork', row.filename, row.version, row.embedded]);
        const bytes = await disk.load('jpg', key, Infinity, () => {
            const task = artworkQueue.then(async () => {
                const file = await localFile(row.filename);
                if (!file) return;
                const { stdout } = await run(process.env.FFMPEG_PATH || 'ffmpeg', [
                    '-v', 'error', '-nostdin', '-protocol_whitelist', 'file', '-i', file.filename,
                    '-map', '0:' + row.embedded, '-frames:v', '1', '-vf', "scale='min(512,iw)':-2",
                    '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1'
                ], { windowsHide: true, encoding: 'buffer', timeout: 6000, maxBuffer: disk.maxBytes });
                return stdout;
            }).catch(() => undefined);
            artworkQueue = task;
            return task;
        });
        if (!res.destroyed) return bytes?.length ? res.type('image/jpeg').send(bytes) : res.sendStatus(404);
    } catch (error) { next(error); }
}

async function playTrack(req, res, next) {
    try {
        const row = catalog?.tracks.get(req.params.id);
        const file = row && await localFile(row.filename);
        if (!file) return res.sendStatus(404);
        if (req.query.convert !== '1') {
            return res.type(row.track.mime).sendFile(file.filename, { cacheControl: false }, error => {
                if (error && !res.destroyed) next(error);
            });
        }
        if (activeConversions >= 2) return res.status(503).json({ error: 'El servidor está convirtiendo otras pistas.' });
        const child = spawn(process.env.FFMPEG_PATH || 'ffmpeg', [
            '-v', 'error', '-nostdin', '-protocol_whitelist', 'file', '-i', file.filename, '-map', '0:a:0',
            '-vn', '-c:a', 'libmp3lame', '-threads', '1', '-ac', '2', '-b:a', '192k', '-f', 'mp3', 'pipe:1'
        ], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
        activeConversions++;
        let failed = false;
        const cancel = () => child.kill();
        const startup = setTimeout(cancel, 10_000).unref();
        res.once('close', cancel);
        if (res.destroyed) cancel();
        child.stdout.once('data', () => clearTimeout(startup));
        res.type('audio/mpeg');
        child.stdout.pipe(res, { end: false });

        child.once('error', () => { failed = true; });
        child.once('close', code => {
            activeConversions--;
            clearTimeout(startup);
            res.off('close', cancel);
            if (res.destroyed) return;
            if (failed || code !== 0) {
                if (res.headersSent) return res.destroy();
                res.removeHeader('Content-Type');
                return res.status(422).json({ error: 'No se pudo convertir esta pista.' });
            }
            res.end();
        });
    } catch (error) { next(error); }
}

module.exports = { getMusicas, getCatalog, sendArtwork, playTrack };
