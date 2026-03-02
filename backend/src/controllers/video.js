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
async function scanDirectory(dirPath) {
  const result = {
    folders: {},
    videos: [],
    thumbnails: []
  };

  const items = await fsp.readdir(dirPath);

  const scanPromises = items.map(async (item) => {
    const itemPath = path.join(dirPath, item);
    const stat = await fsp.stat(itemPath);

    if (stat.isDirectory()) {
      const subDirResult = await scanDirectory(itemPath);
      // Solo incluimos la carpeta si tiene videos en su interior (directos o en sub-ramas)
      if (subDirResult.videos.length > 0 || Object.keys(subDirResult.folders).length > 0) {
        result.folders[item] = subDirResult;
      }
    } else {
      if (isVideo(item)) {
        result.videos.push({
          name: item,
          // Codificamos la ruta en Base64 para que el Frontend la mande limpiamente
          relPath: Buffer.from(path.relative(videoFolder, itemPath)).toString('base64')
        });
      } else if (isImage(item)) {
        result.thumbnails.push(item);
      }
    }
  });

  await Promise.all(scanPromises);
  return result;
}

/**
 * Entregará todas las Categorías > Series > Árbol Recursivo generando de forma asíncrona
 */
async function generateVideoCatalog() {
  const videos = {};

  const categoryPromises = categories.map(async (category) => {
    const categoryPath = path.join(videoFolder, category);

    try {
      await fsp.access(categoryPath); // Equivalente asíncrono a existsSync
    } catch {
      return; // El directorio no existe, saltamos
    }

    const subcategories = await fsp.readdir(categoryPath);

    const subcatPromises = subcategories.map(async (subcategory) => {
      const subcategoryPath = path.join(categoryPath, subcategory);
      const stat = await fsp.stat(subcategoryPath);

      if (stat.isDirectory()) {
        const content = await scanDirectory(subcategoryPath);
        if (content.videos.length > 0 || Object.keys(content.folders).length > 0) {
          if (!videos[category]) videos[category] = {};
          videos[category][subcategory] = content;
        }
      }
    });

    await Promise.all(subcatPromises);
  });

  await Promise.all(categoryPromises);
  return videos;
}

/**
 * Función principal para obtener videos utilizando caché con Stale-While-Revalidate
 */
async function getVideos() {
  const now = Date.now();

  // 1. Caché válida y reciente -> Inmediato
  if (videoCache && (now - lastCacheTime < CACHE_TTL)) {
    return videoCache;
  }

  // 2. Caché caducada pero existe -> Retornamos caché vieja y lanzamos refresco en background
  if (videoCache && (now - lastCacheTime >= CACHE_TTL)) {
    if (!isRefreshing) {
      isRefreshing = true;
      generateVideoCatalog().then(newVideos => {
        videoCache = newVideos;
        lastCacheTime = Date.now();
        isRefreshing = false;
        console.log("[Catálogo Video] Caché revalidada y actualizada en segundo plano.");
      }).catch(err => {
        console.error("[Catálogo Video] Error actualizando la caché:", err);
        isRefreshing = false;
      });
    }
    return videoCache;
  }

  // 3. Sin caché (Primer arranque estricto) -> Esperamos al cálculo
  const newVideos = await generateVideoCatalog();
  videoCache = newVideos;
  lastCacheTime = now;
  return videoCache;
}

module.exports = { getVideos };
