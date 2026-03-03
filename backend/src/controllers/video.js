const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const videoFolder = process.env.VIDEO_FOLDER || './videos';
const categories = ['Peliculas', 'Series', 'Animacion', 'Anime'];

// Caché en memoria para evitar saturar el HDD de la Raspberry Pi con lecturas constantes
let videoCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 300000; // 5 minutos
let isRefreshing = false; // Prevents overlapping background refreshes

function isVideo(file) {
  return ['.mp4', '.mkv', '.avi'].includes(path.extname(file).toLowerCase());
}

function isImage(file) {
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(file).toLowerCase());
}

/**
 * Escanea recursivamente un directorio y devuelve estructura de árbol usando promesas.
 */
/**
 * Escanea un directorio y devuelve estructura de árbol.
 */
async function scanDirectory(dirPath) {
  const result = {
    folders: {},
    videos: [],
    thumbnails: []
  };

  try {
    const items = await fsp.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        const subDirResult = await scanDirectory(itemPath);
        if (subDirResult.videos.length > 0 || Object.keys(subDirResult.folders).length > 0) {
          result.folders[item.name] = subDirResult;
        }
      } else if (item.isFile()) {
        if (isVideo(item.name)) {
          result.videos.push({
            name: item.name,
            relPath: Buffer.from(path.relative(videoFolder, itemPath)).toString('base64')
          });
        } else if (isImage(item.name)) {
          result.thumbnails.push(item.name);
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
  const catalog = {};

  try {
    const categories = await fsp.readdir(videoFolder, { withFileTypes: true });

    // Nivel 1: Categorías (Animacion, Anime, etc.)
    for (const catEntry of categories) {
      if (!catEntry.isDirectory()) continue;

      const categoryName = catEntry.name;
      const categoryPath = path.join(videoFolder, categoryName);
      console.log(`[Escáner] Procesando categoría: "${categoryName}"`);

      const contentEntries = await fsp.readdir(categoryPath, { withFileTypes: true });

      // Nivel 2: Títulos (Carpeta de Serie o Archivo de Película/OVA)
      for (const entry of contentEntries) {
        const entryPath = path.join(categoryPath, entry.name);

        if (entry.isDirectory()) {
          // Es una carpeta (ej: Anime/Boku no Hero)
          const result = await scanDirectory(entryPath);
          if (result.videos.length > 0 || Object.keys(result.folders).length > 0) {
            if (!catalog[categoryName]) catalog[categoryName] = {};
            catalog[categoryName][entry.name] = result;
          }
        } else if (entry.isFile() && isVideo(entry.name)) {
          // Es un video directo (ej: Peliculas/Batman.mkv)
          const titleName = path.parse(entry.name).name;
          if (!catalog[categoryName]) catalog[categoryName] = {};

          catalog[categoryName][titleName] = {
            folders: {},
            videos: [{
              name: entry.name,
              relPath: Buffer.from(path.relative(videoFolder, entryPath)).toString('base64')
            }],
            thumbnails: []
          };
        }
      }
    }
  } catch (err) {
    console.error("[Escáner] Error crítico:", err.message);
  }

  return catalog;
}

/**
 * Caché con refresco inteligente
 */
async function getVideos() {
  const now = Date.now();
  const CACHE_LIMIT = 300000; // 5 minutos

  // 1. Caché válida y reciente -> Inmediato
  if (videoCache && (now - lastCacheTime < CACHE_LIMIT)) {
    return videoCache;
  }

  // 2. Caché caducada pero existe -> Retornamos caché vieja y lanzamos refresco en background
  if (videoCache && (now - lastCacheTime >= CACHE_LIMIT)) {
    if (!isRefreshing) {
      isRefreshing = true;
      generateVideoCatalog().then(newVideos => {
        videoCache = newVideos;
        lastCacheTime = Date.now();
        isRefreshing = false;
        console.log("[Catálogo Video] Caché actualizada automáticamente.");
      }).catch(err => {
        console.error("[Catálogo Video] Fallo en actualización automática:", err);
        isRefreshing = false;
      });
    }
    return videoCache;
  }

  // 3. Sin caché -> Generación inicial
  if (isRefreshing) return videoCache || {}; // Si ya se está cargando, devolver lo que haya

  isRefreshing = true;
  try {
    const newVideos = await generateVideoCatalog();
    videoCache = newVideos;
    lastCacheTime = Date.now();
    return videoCache;
  } finally {
    isRefreshing = false;
  }
}

module.exports = { getVideos };
