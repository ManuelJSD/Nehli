const https = require('https');

// Caché en memoria para no saturar las APIs
const thumbnailCache = new Map();
const infoCache = new Map();

/**
 * Función genérica para hacer peticiones HTTP GET y parsear como JSON
 * usando https nativo de Node para compatibilidad.
 */
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Nehli-App/1.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject('Error parsing JSON');
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Función genérica para hacer peticiones GraphQL a AniList
 */
function fetchAnilist(title) {
    return new Promise((resolve) => {
        const query = `
        query ($search: String) {
            Media (search: $search, type: ANIME) {
                coverImage { extraLarge large medium }
            }
        }`;

        const data = JSON.stringify({ query, variables: { search: title } });

        const options = {
            hostname: 'graphql.anilist.co',
            port: 443,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(body);
                        if (parsed.data && parsed.data.Media && parsed.data.Media.coverImage) {
                            resolve(parsed.data.Media.coverImage.extraLarge || parsed.data.Media.coverImage.large);
                        } else {
                            resolve(null);
                        }
                    } catch (e) { resolve(null); }
                } else {
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => resolve(null));
        req.write(data);
        req.end();
    });
}

/**
 * Función genérica para hacer peticiones GraphQL a AniList y traer Metadata completa
 */
function fetchAnilistInfo(title) {
    return new Promise((resolve) => {
        const query = `
        query ($search: String) {
            Media (search: $search, type: ANIME) {
                description
                seasonYear
                averageScore
                genres
                coverImage { extraLarge large medium }
            }
        }`;

        const data = JSON.stringify({ query, variables: { search: title } });

        const options = {
            hostname: 'graphql.anilist.co',
            port: 443,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(body);
                        if (parsed.data && parsed.data.Media) {
                            const media = parsed.data.Media;
                            resolve({
                                title: title,
                                synopsis: media.description ? media.description.replace(/<[^>]*>?/gm, '') : 'Sin sinopsis disponible.',
                                year: media.seasonYear || null,
                                rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : null,
                                genres: media.genres || [],
                                coverUrl: media.coverImage ? (media.coverImage.extraLarge || media.coverImage.large) : null
                            });
                        } else {
                            resolve(null);
                        }
                    } catch (e) { resolve(null); }
                } else {
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => resolve(null));
        req.write(data);
        req.end();
    });
}

/**
 * Limpia el nombre de la carpeta (subcategory) para obtener un título de búsqueda limpio.
 * Elimina años, resoluciones, tags entre corchetes, números de temporada, etc.
 */
function cleanTitle(rawName) {
    let clean = rawName;

    // 1. Eliminar tags entre corchetes [] o llaves {} (ej: [Erai-raws], [PACK], {Dual})
    clean = clean.replace(/\[.*?\]|\{.*?\}/g, '');

    // 2. Eliminar año y todo lo posterior si hay (ej: (2024), (1999))
    clean = clean.replace(/\(\d{4}\).*$/, '');

    // 3. Eliminar texto genérico entre paréntesis
    clean = clean.replace(/\(.*?\)/g, '');

    // 4. Temporadas y episodios: Season 2, S02, T4, S2 (incluso si están pegados al título como GrandBlueS2)
    // Coincide con espacio/guion opcional seguido de Season, Temporada, S o T, seguido de un número.
    // El final .*$ asegura que descartemos el resto del texto (como S02E05)
    clean = clean.replace(/(?:\s|_|-)*(?:Season|Temporada|S|T)\s*\d+.*$/i, '');

    // 5. Eliminar puntos suspensivos u otros caracteres sueltos al final de la cadena
    clean = clean.replace(/[-_.+]+$/, '');

    // Limpiar espacios extra múltiples
    clean = clean.replace(/\s{2,}/g, ' ');

    return clean.trim();
}

/**
 * Obtiene la URL de la portada consultando APIs gratuitas.
 */
async function fetchThumbnailUrl(category, rawTitle) {
    const title = cleanTitle(rawTitle);
    const cacheKey = `${category}-${title}`;

    if (thumbnailCache.has(cacheKey)) {
        return thumbnailCache.get(cacheKey);
    }

    let externalUrl = null;

    if (category === 'Anime') {
        // First try AniList GraphQL (Extremely robust, 90 requests/min limit)
        externalUrl = await fetchAnilist(title);

        // If AniList fails, fallback to iTunes
        if (!externalUrl) {
            try {
                const itunesData = await fetchJSON(`https://itunes.apple.com/search?media=tvShow&term=${encodeURIComponent(title)}&limit=1`);
                if (itunesData && itunesData.results && itunesData.results.length > 0 && itunesData.results[0].artworkUrl100) {
                    externalUrl = itunesData.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
                }
            } catch (e) { console.error('iTunes fallback failed:', e.message); }
        }
    }
    else if (category === 'Series') {
        // First try TVMaze
        try {
            const tvmazeData = await fetchJSON(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`);
            if (tvmazeData && tvmazeData.length > 0) {
                externalUrl = tvmazeData[0].show?.image?.original || tvmazeData[0].show?.image?.medium;
            }
        } catch (e) { console.error('TVMaze failed:', e.message); }

        // If TVMaze fails (e.g. localized spanish title), fallback to iTunes
        if (!externalUrl) {
            try {
                const itunesData = await fetchJSON(`https://itunes.apple.com/search?media=tvShow&term=${encodeURIComponent(title)}&limit=1`);
                if (itunesData && itunesData.results && itunesData.results.length > 0 && itunesData.results[0].artworkUrl100) {
                    externalUrl = itunesData.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
                }
            } catch (e) { console.error('iTunes fallback failed:', e.message); }
        }
    }
    else if (category === 'Peliculas' || category === 'Animacion') {
        // Peliculas use iTunes naturally
        try {
            const itunesData = await fetchJSON(`https://itunes.apple.com/search?media=movie&term=${encodeURIComponent(title)}&limit=1`);
            if (itunesData && itunesData.results && itunesData.results.length > 0 && itunesData.results[0].artworkUrl100) {
                externalUrl = itunesData.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
            }
        } catch (e) { console.error('iTunes movie failed:', e.message); }
    }

    console.log(`Thumbnail search for: Original="${rawTitle}", Cleaned="${title}" => Found: ${externalUrl ? 'YES' : 'NO'}`);
    // Guardamos en caché independientemente de si encontró algo o no (para no repetir búsquedas fallidas)
    // Si no encontró nada, guardamos 'null' y en el middleware devolveremos 404
    thumbnailCache.set(cacheKey, externalUrl);
    return externalUrl;
}

/**
 * Controlador para la ruta GET /video/thumbnail
 */
const getThumbnail = async (req, res) => {
    const { category, title } = req.query;

    if (!category || !title) {
        return res.status(400).json({ error: 'Faltan parámetros category y title' });
    }

    const url = await fetchThumbnailUrl(category, title);

    if (url) {
        // Redirigir a la imagen externa
        res.redirect(302, url);
    } else {
        // 404 para que el frontend ponga la imagen por defecto
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.status(404).json({ error: 'No se encontró una miniatura' });
    }
};

/**
 * Obtiene la metadata consultando APIs gratuitas.
 */
async function fetchInfoMetadata(category, rawTitle) {
    const title = cleanTitle(rawTitle);
    const cacheKey = `${category}-${title}-info`;

    if (infoCache.has(cacheKey)) {
        return infoCache.get(cacheKey);
    }

    let metadata = {
        title: rawTitle,
        synopsis: 'Sin información disponible.',
        year: null,
        rating: null,
        genres: [],
        coverUrl: null
    };

    let foundInfo = false;

    if (category === 'Anime') {
        const aniData = await fetchAnilistInfo(title);
        if (aniData) {
            metadata = { ...metadata, ...aniData };
            foundInfo = true;
        } else {
            try {
                const itunesData = await fetchJSON(`https://itunes.apple.com/search?media=tvShow&term=${encodeURIComponent(title)}&limit=1`);
                if (itunesData && itunesData.results && itunesData.results.length > 0) {
                    const res = itunesData.results[0];
                    metadata.synopsis = res.longDescription || res.description || metadata.synopsis;
                    metadata.year = res.releaseDate ? res.releaseDate.substring(0, 4) : null;
                    metadata.genres = res.primaryGenreName ? [res.primaryGenreName] : [];
                    metadata.coverUrl = res.artworkUrl100 ? res.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : null;
                    foundInfo = true;
                }
            } catch (e) { console.error('iTunes fallback failed:', e.message); }
        }
    }
    else if (category === 'Series') {
        try {
            const tvmazeData = await fetchJSON(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`);
            if (tvmazeData && tvmazeData.length > 0) {
                const show = tvmazeData[0].show;
                metadata.synopsis = show.summary ? show.summary.replace(/<[^>]*>?/gm, '') : metadata.synopsis;
                metadata.year = show.premiered ? show.premiered.substring(0, 4) : null;
                metadata.rating = show.rating?.average || null;
                metadata.genres = show.genres || [];
                metadata.coverUrl = show.image?.original || show.image?.medium || null;
                foundInfo = true;
            }
        } catch (e) { console.error('TVMaze failed:', e.message); }

        if (!foundInfo) {
            try {
                const itunesData = await fetchJSON(`https://itunes.apple.com/search?media=tvShow&term=${encodeURIComponent(title)}&limit=1`);
                if (itunesData && itunesData.results && itunesData.results.length > 0) {
                    const res = itunesData.results[0];
                    metadata.synopsis = res.longDescription || res.description || metadata.synopsis;
                    metadata.year = res.releaseDate ? res.releaseDate.substring(0, 4) : null;
                    metadata.genres = res.primaryGenreName ? [res.primaryGenreName] : [];
                    metadata.coverUrl = res.artworkUrl100 ? res.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : null;
                    foundInfo = true;
                }
            } catch (e) { console.error('iTunes fallback failed:', e.message); }
        }
    }
    else if (category === 'Peliculas' || category === 'Animacion') {
        try {
            const itunesData = await fetchJSON(`https://itunes.apple.com/search?media=movie&term=${encodeURIComponent(title)}&limit=1`);
            const esData = await fetchJSON(`https://itunes.apple.com/search?media=movie&term=${encodeURIComponent(title)}&country=es&lang=es_es&limit=1`);

            // Prioridad a los resultados en español
            const bestRes = (esData && esData.results && esData.results.length > 0) ? esData.results[0] :
                (itunesData && itunesData.results && itunesData.results.length > 0) ? itunesData.results[0] : null;

            if (bestRes) {
                metadata.synopsis = bestRes.longDescription || bestRes.description || metadata.synopsis;
                metadata.year = bestRes.releaseDate ? bestRes.releaseDate.substring(0, 4) : null;
                metadata.genres = bestRes.primaryGenreName ? [bestRes.primaryGenreName] : [];
                metadata.coverUrl = bestRes.artworkUrl100 ? bestRes.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : null;
                foundInfo = true;
            }
        } catch (e) { console.error('iTunes movie failed:', e.message); }
    }

    infoCache.set(cacheKey, metadata);
    return metadata;
}

/**
 * Controlador para la ruta GET /video/info
 */
const getInfo = async (req, res) => {
    const { category, title } = req.query;

    if (!category || !title) {
        return res.status(400).json({ error: 'Faltan parámetros category y title' });
    }

    const metadata = await fetchInfoMetadata(category, title);

    res.json(metadata);
};

module.exports = { getThumbnail, getInfo };
