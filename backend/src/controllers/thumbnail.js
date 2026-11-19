const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { getVideos, onCatalogRefresh } = require('./video');
const disk = require('../utils/metadataCache');
const overrides = require('../utils/metadataOverrides');
const runFile = promisify(execFile);
const frameCache = new Map();
const frameQueue = [];
const frameLimit = 2;
let activeFrames = 0;

const library = path.resolve(process.env.VIDEO_FOLDER || './videos');
const cache = new Map();
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const coverNames = ['poster', 'cover', 'portada', 'folder'];


function safeSegment(value) {
    return typeof value === 'string' && value.length > 0 && value !== '.' &&
        value !== '..' && !/[\\/\0]/.test(value) && path.basename(value) === value;
}

function isWithin(root, target) {
    const relative = path.relative(root, target);
    return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

async function localFile(root, file) {
    try {
        const real = await fs.realpath(file);
        return isWithin(root, real) && (await fs.stat(real)).isFile() ? real : undefined;
    } catch {
        return undefined;
    }
}

function stringValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function readLocal(category, title) {
    let root;
    let entries;
    let categoryPath;
    try {
        root = await fs.realpath(library);
        categoryPath = await fs.realpath(path.join(root, category));
        if (!isWithin(root, categoryPath)) return {};
        entries = await fs.readdir(categoryPath, { withFileTypes: true });
    } catch {
        return {};
    }

    const folder = entries.find(entry => entry.name === title && entry.isDirectory());
    const directory = folder ? path.join(categoryPath, title) : categoryPath;
    const metadataFile = await localFile(root, path.join(directory, folder ? 'metadata.json' : title + '.metadata.json'));
    let fields = {};
    if (metadataFile) {
        try {
            if ((await fs.stat(metadataFile)).size <= 64 * 1024) {
                const json = JSON.parse(await fs.readFile(metadataFile, 'utf8'));
                fields = Object.fromEntries(Object.entries({
                    title: stringValue(json.title),
                    synopsis: stringValue(json.synopsis),
                    year: /^\d{4}$/.test(String(json.year)) ? Number(json.year) : undefined,
                    genres: Array.isArray(json.genres) ? json.genres.filter(value => typeof value === 'string') : undefined,
                    cover: safeSegment(json.cover) ? json.cover : undefined
                }).filter(([, value]) => value !== undefined));
            }
        } catch {
            // Una ficha local inválida no impide consultar otras fuentes.
        }
    }

    const images = (folder ? await fs.readdir(directory, { withFileTypes: true }).catch(() => []) : entries)
        .filter(entry => entry.isFile() && imageExtensions.includes(path.extname(entry.name).toLowerCase()))
        .map(entry => entry.name);
    const preferred = folder ? [...coverNames, title.toLowerCase()]
        : [title.toLowerCase(), title.toLowerCase() + '.poster', title.toLowerCase() + '.cover'];
    const inferred = preferred.map(name => images.find(image => path.parse(image).name.toLowerCase() === name)).find(Boolean);
    const cover = await localFile(root, path.join(directory,
        images.includes(fields.cover) ? fields.cover : inferred || (folder && images.length === 1 ? images[0] : '')));
    delete fields.cover;
    return { fields, cover };
}

function normalize(title) {
    return title.normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
        .replace(/\b(\d+)(?:st|nd|rd|th) season\b/g, 'season $1')
        .replace(/\b(?:temporada\s+|[st]0*)([1-9]\d*)$/g, 'season $1').trim();
}

function titleIdentity(rawTitle) {
    const withoutTags = rawTitle.replace(/\[[^\]]*\]|\{[^}]*\}/g, ' ').replace(/\s+HDO\s*$/i, '');
    const year = Number(withoutTags.match(/\((19\d{2}|20\d{2})\)|^((?:19|20)\d{2})\s*-\s*|[._]((?:19|20)\d{2})(?=[._](?:720p|1080p|2160p|4k))/i)?.slice(1).find(Boolean)) || undefined;
    const title = withoutTags
        .replace(/\((?:19|20)\d{2}\)|^(?:19|20)\d{2}\s*-\s*|[._](?:19|20)\d{2}(?=[._](?:720p|1080p|2160p|4k))/gi, ' ')
        .replace(/(?:[\s._-]+)(?:720p|1080p|2160p|4k|web[- .]?dl|bluray|bdrip|x26[45]|bd)\b.*$/i, '')
        .replace(/_/g, ' ').replace(/(?<=\w)\.(?=\w)/g, ' ')
        .replace(/\s+/g, ' ').replace(/[-_.]+$/g, '').trim();
    return { title, year, key: normalize(title) };
}

function findMatch(candidates, identity) {
    const matches = candidates.filter(candidate =>
        (!identity.year || identity.year === candidate.year) &&
        candidate.titles.some(title => typeof title === 'string' && normalize(title) === identity.key));
    if (!matches.length) return undefined;
    // Un título homónimo sin año no identifica por sí solo la obra.
    const years = new Set(matches.map(match => match.year).filter(Boolean));
    return years.size > 1 ? undefined : matches[0];
}

function stripMarkup(value) {
    return typeof value === 'string' ? value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').trim() : undefined;
}

function request(url, options = {}) {
    return new Promise(resolve => {
        const req = https.request(url, {
            method: options.method,
            headers: { 'User-Agent': 'Nehli/1.0 (+https://github.com/ManuelJSD/Nehli-Front)', ...options.headers }
        }, response => {
            if (response.statusCode !== 200) {
                clearTimeout(deadline);
                response.resume();
                resolve(undefined);
                return;
            }
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => {
                body += chunk;
                if (body.length > 2 * 1024 * 1024) req.destroy();
            });
            response.on('end', () => {
                clearTimeout(deadline);
                try { resolve(JSON.parse(body)); } catch { resolve(undefined); }
            });
            response.on('error', () => resolve(undefined));
        });
        const deadline = setTimeout(() => req.destroy(new Error('Tiempo de espera agotado')), 4500);
        req.on('error', () => resolve(undefined));
        req.on('close', () => {
            clearTimeout(deadline);
            resolve(undefined);
        });
        req.end(options.body);
    });
}


async function searchAnime(title) {
    const response = await request('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: 'query ($title: String) { Page(perPage: 8) { media(type: ANIME, search: $title) { id title { romaji english native } synonyms startDate { year } description(asHtml: false) averageScore genres coverImage { large } } } }',
            variables: { title }
        })
    });
    return (response?.data?.Page?.media || []).map(media => ({
        id: media.id,
        titles: [...Object.values(media.title || {}), ...(media.synonyms || [])].filter(Boolean),
        year: media.startDate?.year, synopsis: stripMarkup(media.description),
        rating: media.averageScore ? media.averageScore / 10 : null,
        genres: media.genres, coverUrl: media.coverImage?.large
    }));
}

async function searchSeries(title) {
    const response = await request('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(title));
    return (Array.isArray(response) ? response : []).map(({ show }) => ({
        titles: [show.name], year: Number(show.premiered?.slice(0, 4)),
        synopsis: stripMarkup(show.summary), rating: show.rating?.average,
        genres: show.genres, coverUrl: show.image?.original || show.image?.medium
    }));
}

async function searchStore(title, movie, country) {
    const params = new URLSearchParams({ term: title, country, entity: movie ? 'movie' : 'tvSeason', limit: '12' });
    const response = await request('https://itunes.apple.com/search?' + params);
    return (response?.results || []).map(result => ({
        titles: [movie ? result.trackName : result.artistName, result.collectionName],
        year: Number(result.releaseDate?.slice(0, 4)),
        synopsis: result.longDescription || result.description,
        genres: result.primaryGenreName ? [result.primaryGenreName] : [],
        coverUrl: result.artworkUrl100?.replace('100x100bb', '600x600bb')
    }));
}

async function searchWiki(identity, language) {
    const base = 'https://' + language + '.wikipedia.org';
    const params = new URLSearchParams({
        action: 'query', generator: 'search', gsrsearch: identity.title + (identity.year ? ' ' + identity.year : '') +
            (language === 'es' ? ' película' : ' film'), gsrnamespace: '0', gsrlimit: '8',
        prop: 'extracts|redirects|pageprops|info', inprop: 'url', exintro: '1',
        explaintext: '1', exlimit: 'max', exchars: '600', rdnamespace: '0', rdlimit: 'max',
        formatversion: '2', format: 'json'
    });
    const answer = await request(base + '/w/api.php?' + params);
    const type = language === 'es' ? /(?:película|largometraje)[^.]{0,140}?\b((?:19|20)\d{2})\b/i
        : /\b((?:19|20)\d{2})\b[^.]{0,90}?\bfilm\b/i;
    const qualifier = /\s+\((?:película|film|largometraje)(?:\s+(?:de\s+)?\d{4})?\)$/i;
    const entries = (answer?.query?.pages || []).flatMap(page => {
        if (page.pageprops?.disambiguation !== undefined || !page.extract) return [];
        const year = Number(page.extract.match(type)?.[1]);
        if (!year) return [];
        const titles = [page.title, ...(page.redirects || []).map(redirect => redirect.title)].map(title => title.replace(qualifier, ''));
        return [{ titles, year, synopsis: page.extract.trim(),
            sourceUrl: base + '/wiki/' + encodeURIComponent(page.title.replace(/ /g, '_')) }];
    });
    return findMatch(entries, identity);
}

function firstVideo(entry) {
    if (entry?.videos?.length) return entry.videos[0];
    for (const child of Object.values(entry?.folders || {})) {
        const video = firstVideo(child);
        if (video) return video;
    }
    return undefined;
}

async function captureFrame(filename) {
    const executable = process.env.FFMPEG_PATH || 'ffmpeg';
    for (const seek of [['-ss', '45'], []]) {
        try {
            const { stdout } = await runFile(executable, [
                '-v', 'error', ...seek, '-protocol_whitelist', 'file', '-i', filename,
                '-map', '0:V:0', '-frames:v', '1', '-filter_threads', '1', '-vf', 'scale=480:-2',
                '-threads:v', '1', '-c:v', 'mjpeg', '-q:v', '4', '-f', 'image2pipe', 'pipe:1'
            ], { encoding: 'buffer', timeout: 18000, maxBuffer: 800 * 1024, windowsHide: true });
            if (stdout.length) return stdout;
        } catch {
            // Se intenta desde el principio si el medio no admite este salto.
        }
    }
    return undefined;
}

let frameWakeup;
function drainFrameQueue() {
    while (activeFrames < frameLimit && frameQueue.length) {
        const index = frameQueue.findIndex(job => !job.background);
        if (index < 0 && disk.playbackBusy()) {
            if (!frameWakeup) frameWakeup = setTimeout(() => { frameWakeup = undefined; drainFrameQueue(); }, 2000).unref();
            return;
        }
        const [{ filename, resolve }] = frameQueue.splice(Math.max(0, index), 1);
        activeFrames++;
        captureFrame(filename).then(resolve, () => resolve(undefined)).finally(() => {
            activeFrames--;
            drainFrameQueue();
        });
    }
}

async function fallbackFrame(category, title, entry, background = false) {
    const video = firstVideo(entry || (await getVideos())[category]?.[title]);
    if (!video) return undefined;
    const root = await fs.realpath(library);
    const filename = await localFile(root, path.resolve(root, Buffer.from(video.relPath, 'base64').toString()));
    if (!filename) return undefined;
    const stat = await fs.stat(filename);
    const key = JSON.stringify([filename, stat.size, stat.mtimeMs]);
    const cached = frameCache.get(key);
    if (cached) {
        if (!background) {
            for (const job of frameQueue) {
                if (job.filename === filename) job.background = false;
            }
            drainFrameQueue();
        }
        return cached;
    }
    const result = disk.load('jpg', key, Infinity, () => {
        if (frameQueue.length >= 48) return undefined;
        const frame = new Promise(resolve => frameQueue.push({ filename, resolve, background }));
        drainFrameQueue();
        return frame;
    });
    frameCache.set(key, result);
    if (frameCache.size > 128) frameCache.delete(frameCache.keys().next().value);
    const frame = await result;
    if (!frame && frameCache.get(key) === result) frameCache.delete(key);
    return frame;
}

async function resolveExternal(category, identity) {
    const normalizedCategory = normalize(category);
    if (!identity.key) return undefined;
    if (normalizedCategory === 'anime') {
        const search = /\bseason \d+$/.test(identity.key) ? identity.key : identity.title;
        const anime = findMatch(await searchAnime(search), identity);
        if (anime) return anime;
        if (!/\b(?:movie|pelicula|infinity castle|mugen jou hen)\b/.test(identity.key)) return undefined;
    }
    if (normalizedCategory === 'series') {
        const title = identity.title.replace(/(?:[\s_-]+)(?:s\d+|t\d+|season\s+\d+|temporada\s+\d+)$/i, '');
        const showIdentity = { ...identity, title, key: normalize(title) };
        const series = findMatch(await searchSeries(title), showIdentity);
        if (series) return series;
        return findMatch(await searchStore(title, false, 'ES'), showIdentity);
    }
    if (!['peliculas', 'animacion', 'anime'].includes(normalizedCategory)) return undefined;

    const [store, wiki] = await Promise.all([
        searchStore(identity.title, true, 'ES').then(results => findMatch(results, identity)),
        searchWiki(identity, 'es')
    ]);
    if (store?.synopsis) return store;
    const article = wiki || await searchWiki(identity, 'en');
    return article ? { ...article, coverUrl: store?.coverUrl } : store;
}

function externalMetadata(category, title, year) {
    const key = JSON.stringify([category, title, year]);
    const previous = cache.get(key);
    if (previous && Date.now() < previous.expires) return previous.result;
    const identity = titleIdentity(title);
    identity.year = year || identity.year;
    const entry = { expires: Infinity };
    entry.result = (async () => {
        const saved = await disk.read('json', key, 6 * 60 * 60 * 1000);
        if (saved) {
            try { return JSON.parse(saved.toString('utf8')); } catch {}
        }
        const result = await resolveExternal(category, identity).catch(() => undefined);
        if (result) await disk.write('json', key, Buffer.from(JSON.stringify(result)));
        return result;
    })().then(result => {
        entry.expires = Date.now() + (result ? 6 * 60 * 60 * 1000 : 5 * 60 * 1000);
        return result;
    });
    cache.delete(key);
    if (cache.size >= 512) cache.delete(cache.keys().next().value);
    cache.set(key, entry);
    return entry.result;
}

function titleHandler(handler) {
    return async (req, res, next) => {
        const { category, title } = req.query;
        if (!safeSegment(category) || !safeSegment(title)) {
            return res.status(400).json({ error: 'Categoría o título no válido' });
        }
        try {
            const local = await readLocal(category, title);
            await handler(res, category, title, local, req);
        } catch (error) {
            next(error);
        }
    };
}

function validCover(url) {
    return typeof url === 'string' && /^https:\/\//i.test(url);
}

function downloadCover(value) {
    let url;
    try { url = new URL(value); } catch { return undefined; }
    if (url.protocol !== 'https:' || url.port || url.username || url.password ||
        !/^(?:s[0-9]+\.anilist\.co|static\.tvmaze\.com|(?:[a-z0-9-]+\.)?mzstatic\.com)$/i.test(url.hostname)) return undefined;

    return new Promise(resolve => {
        const req = https.get(url, response => {
            const mime = response.headers['content-type']?.split(';')[0];
            const formats = { 'image/jpeg': 1, 'image/png': 2, 'image/webp': 3, 'image/gif': 4 };
            if (response.statusCode !== 200 || !formats[mime]) {
                response.resume();
                resolve(undefined);
                return;
            }
            const chunks = [Buffer.from([formats[mime]])];
            let size = 1;
            response.on('data', chunk => {
                size += chunk.length;
                if (size > disk.maxBytes) req.destroy();
                else chunks.push(chunk);
            });
            response.on('end', () => resolve(size > 1 && size <= disk.maxBytes ? Buffer.concat(chunks) : undefined));
            response.on('error', () => resolve(undefined));
        });
        const deadline = setTimeout(() => req.destroy(), 4500);
        req.on('error', () => resolve(undefined));
        req.on('close', () => {
            clearTimeout(deadline);
            resolve(undefined);
        });
    });
}

let warming = false;
let queuedCatalog;
function prewarmCatalog(catalog) {
    queuedCatalog = catalog;
    if (!warming) void warm();
}

async function warm() {
    warming = true;
    try {
        while (queuedCatalog) {
            const catalog = queuedCatalog;
            queuedCatalog = undefined;
            for (const [category, titles] of Object.entries(catalog)) {
                for (const [title, entry] of Object.entries(titles)) {
                    while (disk.playbackBusy()) await pause(2000);
                    try {
                        const edited = await overrides.read(category, title);
                        const { fields, cover } = await readLocal(category, title);
                        if (edited.image || edited.match || (cover && fields?.synopsis)) continue;
                        const match = await externalMetadata(category, fields?.title || title, fields?.year);
                        while (disk.playbackBusy()) await pause(2000);
                        if (!cover) {
                            if (validCover(match?.coverUrl)) {
                                const cached = await disk.load('cover', match.coverUrl, 7 * 86400000, () => downloadCover(match.coverUrl));
                                if (cached) continue;
                            }
                            await fallbackFrame(category, title, entry, true);
                        }
                    } catch {
                        // Un título inaccesible no debe detener la preparación de la biblioteca.
                    }
                    await pause(1000);
                }
            }
        }
    } finally {
        warming = false;
    }
}

function pause(ms) {
    return new Promise(resolve => setTimeout(resolve, ms).unref());
}


const getThumbnail = titleHandler(async (res, category, title, { fields, cover }) => {
    const edited = await overrides.read(category, title);
    const uploaded = overrides.decodeImage(edited.image);
    if (uploaded) return res.set('Cache-Control', 'no-cache').type(uploaded.mime).send(uploaded.bytes);
    if (cover && !edited.match?.coverUrl) return res.sendFile(cover, { cacheControl: false, headers: { 'Cache-Control': 'no-cache' } });
    const match = edited.match || await externalMetadata(category, fields?.title || title, fields?.year);
    res.set('Cache-Control', 'no-cache');
    if (validCover(match?.coverUrl)) {
        const cover = await disk.load('cover', match.coverUrl, 7 * 86400000, () => downloadCover(match.coverUrl));
        const mime = cover && [null, 'image/jpeg', 'image/png', 'image/webp', 'image/gif'][cover[0]];
        if (mime && cover.length > 1) return res.type(mime).send(cover.subarray(1));
        return res.redirect(302, match.coverUrl);
    }
    if (!res.destroyed) {
        const frame = await fallbackFrame(category, title);
        if (frame) return res.type('jpeg').send(frame);
        if (!res.destroyed) res.status(404).json({ error: 'No se encontró una portada' });
    }
});

async function titleInfo(category, title, { fields, cover }, edited) {
    const match = edited.match || (fields?.synopsis && cover ? undefined
        : await externalMetadata(category, fields?.title || title, fields?.year));
    return {
        title: edited.title || edited.match?.title || fields?.title || title,
        synopsis: edited.synopsis || edited.match?.synopsis || fields?.synopsis || match?.synopsis || null,
        year: edited.match?.year || fields?.year || match?.year || null,
        rating: match?.rating ?? null,
        genres: edited.match?.genres || fields?.genres || match?.genres || [],
        sourceUrl: edited.synopsis || fields?.synopsis ? undefined : match?.sourceUrl,
        coverUrl: !edited.image && (!cover || edited.match) && validCover(match?.coverUrl) ? match.coverUrl : null
    };
}

const getInfo = titleHandler(async (res, category, title, local) => {
    const edited = await overrides.read(category, title);
    res.json(await titleInfo(category, title, local, edited));
});

function animeCandidate(candidate) {
    const { id, titles, synopsis, year, rating, genres, coverUrl } = candidate;
    return { id, title: titles[0], synopsis, year, rating, genres,
        coverUrl: /^https:\/\/s\d+\.anilist\.co\//.test(coverUrl || '') ? coverUrl : undefined };
}

async function findAnime(id) {
    const response = await request('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: 'query ($id: Int) { Media(id: $id, type: ANIME) { id title { romaji english native } startDate { year } description(asHtml: false) averageScore genres coverImage { large } } }',
            variables: { id }
        })
    });
    const media = response?.data?.Media;
    if (!media) return;
    return animeCandidate({
        id: media.id, titles: Object.values(media.title || {}).filter(Boolean),
        synopsis: stripMarkup(media.description), year: media.startDate?.year,
        rating: media.averageScore ? media.averageScore / 10 : null, genres: media.genres, coverUrl: media.coverImage?.large
    });
}

const searchEditorAnime = titleHandler(async (res, category, title, local, req) => {
    if (normalize(category) !== 'anime') return res.sendStatus(400);
    const query = stringValue(req.query.q);
    if (!query || query.length > 160) return res.sendStatus(400);
    res.set('Cache-Control', 'no-store').json((await searchAnime(query)).map(animeCandidate));
});

const getEditor = titleHandler(async (res, category, title, local) => {
    const { image, ...edited } = await overrides.read(category, title);
    res.set('Cache-Control', 'no-store').json({ ...edited, hasImage: Boolean(image) });
});

const saveEditor = titleHandler(async (res, category, title, local, req) => {
    const { displayTitle, synopsis, animeId, image } = req.body || {};
    if (typeof displayTitle !== 'string' || displayTitle.length > 240 ||
        typeof synopsis !== 'string' || synopsis.length > 8000 ||
        (animeId !== null && (normalize(category) !== 'anime' || !Number.isSafeInteger(animeId) || animeId <= 0 || animeId > 2147483647)) ||
        (image !== undefined && image !== null && !overrides.decodeImage(image))) {
        return res.status(400).json({ error: 'Los datos de la ficha no son válidos.' });
    }
    const catalog = await getVideos();
    if (!Object.hasOwn(catalog, category) || !Object.hasOwn(catalog[category], title)) return res.sendStatus(404);

    const previous = await overrides.read(category, title);
    const match = animeId === null ? undefined
        : previous.match?.id === animeId ? previous.match : await findAnime(animeId);
    if (animeId !== null && !match) {
        return res.status(502).json({ error: 'No se pudo recuperar esa ficha de AniList.' });
    }
    const edited = {
        title: stringValue(displayTitle),
        synopsis: stringValue(synopsis),
        match,
        image: image === undefined ? previous.image : image || undefined
    };
    await overrides.write(category, title, edited);
    // Respond without an external lookup so the client can reflect the saved state immediately.
    res.sendStatus(204);
});

onCatalogRefresh(prewarmCatalog);
module.exports = { getThumbnail, getInfo, getEditor, saveEditor, searchEditorAnime };