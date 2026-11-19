const { execFile } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { promisify } = require('util');

const videoFolder = process.env.VIDEO_FOLDER || './videos';
const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';
const runFile = promisify(execFile);
const VIDEO_EXTENSIONS = new Set([
  '.3g2', '.3gp', '.avi', '.divx', '.dv', '.f4v', '.flv', '.m2ts', '.m4v', '.mkv',
  '.mov', '.mp4', '.mpe', '.mpeg', '.mpg', '.mts', '.ogm', '.ogv', '.rmvb', '.ts',
  '.vob', '.webm', '.wmv', '.wtv'
]);
const THUMBNAIL_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const NON_VIDEO_EXTENSIONS = new Set([
  ...THUMBNAIL_EXTENSIONS,
  '.apng', '.avif', '.bmp', '.heic', '.heif', '.ico', '.jxl', '.svg', '.tif', '.tiff',
  '.aac', '.ac3', '.aif', '.aiff', '.alac', '.ape', '.eac3', '.flac', '.m4a', '.mp3',
  '.oga', '.opus', '.wav', '.wma', '.ass', '.idx', '.sami', '.smi', '.srt', '.ssa',
  '.sub', '.sup', '.ttml', '.vtt', '.md', '.txt', '.nfo', '.json', '.xml', '.pdf',
  '.ini', '.db', '.cue', '.m3u', '.m3u8', '.mpd', '.url', '.torrent', '.zip', '.rar', '.7z'
]);
const STILL_IMAGE_FORMATS = new Set(['apng', 'fits', 'gif', 'ico', 'image2', 'image2pipe', 'svg', 'svg_pipe']);

// Caché en memoria para evitar saturar el HDD de la Raspberry Pi con lecturas constantes
let videoCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 300000; // 5 minutos
let refreshPromise = null;
let probeCache = new Map();
const catalogListeners = [];

async function isVideo(filePath, scan) {
  const extension = path.extname(filePath).toLowerCase();
  if (VIDEO_EXTENSIONS.has(extension)) return true;
  if (NON_VIDEO_EXTENSIONS.has(extension) || path.basename(filePath).startsWith('.')) return false;

  const stat = await fsp.stat(filePath).catch(() => null);
  if (!stat?.isFile()) return false;

  const signature = `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
  const cached = probeCache.get(filePath);
  if (cached?.signature === signature) {
    scan.probes.set(filePath, cached);
    return cached.isVideo;
  }
  if (scan.ffprobeUnavailable) return false;

  let isVideo = false;
  try {
    const { stdout } = await runFile(ffprobePath, [
      '-v', 'error', '-protocol_whitelist', 'file', '-select_streams', 'V:0',
      '-show_entries', 'stream=index:format=format_name:format_tags=major_brand',
      '-of', 'json', path.resolve(filePath)
    ], { timeout: 5000, maxBuffer: 64 * 1024, windowsHide: true });
    const { streams, format } = JSON.parse(stdout);
    const formatName = format?.format_name || '';
    const majorBrand = format?.tags?.major_brand?.trim();
    isVideo = streams?.length > 0 && !STILL_IMAGE_FORMATS.has(formatName)
      && !formatName.endsWith('_pipe') && majorBrand !== 'avif' && majorBrand !== 'avis';
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      scan.ffprobeUnavailable = true;
      console.warn(`[Escáner] No se pudo ejecutar FFprobe: ${error.message}`);
    }
    // Un fallo temporal al ejecutar FFprobe se reintenta en el próximo escaneo.
    if (typeof error.code !== 'number') return false;
  }

  scan.probes.set(filePath, { signature, isVideo });
  return isVideo;
}

function videoEntry(name, filePath) {
  return {
    name,
    relPath: Buffer.from(path.relative(videoFolder, filePath)).toString('base64')
  };
}

/**
 * Escanea recursivamente un directorio y devuelve su estructura de árbol.
 */
async function scanDirectory(dirPath, scan) {
  const result = {
    folders: Object.create(null),
    videos: [],
    thumbnails: []
  };

  try {
    const items = await fsp.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        const subDirResult = await scanDirectory(itemPath, scan);
        if (subDirResult.videos.length > 0 || Object.keys(subDirResult.folders).length > 0) {
          result.folders[item.name] = subDirResult;
        }
      } else if (item.isFile()) {
        if (THUMBNAIL_EXTENSIONS.has(path.extname(item.name).toLowerCase())) {
          result.thumbnails.push(item.name);
        } else if (await isVideo(itemPath, scan)) {
          result.videos.push(videoEntry(item.name, itemPath));
        }
      }
    }
  } catch (err) {
    // Error silencioso
  }

  return result;
}

/**
 * Entregará todas las Categorías > Títulos (Carpeta o Archivo) > Contenido
 */
async function generateVideoCatalog() {
  console.log(`[Escáner] Iniciando escaneo profundo en: ${videoFolder}`);
  const catalog = Object.create(null);
  const scan = { probes: new Map(), ffprobeUnavailable: false };

  try {
    const categories = await fsp.readdir(videoFolder, { withFileTypes: true });

    // Nivel 1: Categorías (Animacion, Anime, etc.)
    for (const catEntry of categories) {
      if (!catEntry.isDirectory()) continue;

      const categoryName = catEntry.name;
      const categoryPath = path.join(videoFolder, categoryName);
      console.log(`[Escáner] Procesando categoría: "${categoryName}"`);

      const contentEntries = await fsp.readdir(categoryPath, { withFileTypes: true });
      const titles = Object.create(null);

      // Nivel 2: Títulos (Carpeta de Serie o Archivo de Película/OVA)
      for (const entry of contentEntries) {
        const entryPath = path.join(categoryPath, entry.name);

        if (entry.isDirectory()) {
          // Es una carpeta (ej: Anime/Boku no Hero)
          const result = await scanDirectory(entryPath, scan);
          if (result.videos.length > 0 || Object.keys(result.folders).length > 0) {
            if (titles[entry.name]) result.videos.push(...titles[entry.name].videos);
            titles[entry.name] = result;
          }
        } else if (entry.isFile() && await isVideo(entryPath, scan)) {
          const titleName = path.parse(entry.name).name;
          const title = titles[titleName] ??= { folders: {}, videos: [], thumbnails: [] };
          title.videos.push(videoEntry(entry.name, entryPath));
        }
      }
      if (Object.keys(titles).length) catalog[categoryName] = titles;
    }
  } catch (err) {
    console.error("[Escáner] Error crítico:", err.message);
  }

  probeCache = scan.probes;
  return catalog;
}

/**
 * Caché con refresco inteligente
 */
async function getVideos() {
  if (videoCache && Date.now() - lastCacheTime < CACHE_TTL) {
    return videoCache;
  }

  if (!refreshPromise) {
    refreshPromise = generateVideoCatalog().then(newVideos => {
      videoCache = newVideos;
      lastCacheTime = Date.now();
      return newVideos;
    }).finally(() => {
      refreshPromise = null;
    });
    refreshPromise.catch(error => console.error('[Catálogo Video] Fallo en la actualización:', error));
  }

  return videoCache ?? refreshPromise;
}

function onCatalogRefresh(listener) {
  catalogListeners.push(listener);
}

module.exports = { getVideos, onCatalogRefresh };
