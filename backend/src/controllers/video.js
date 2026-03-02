const fs = require('fs');
const path = require('path');

const videoFolder = process.env.VIDEO_FOLDER || './videos';
const categories = ['Peliculas', 'Series', 'Animacion', 'Anime'];

// Caché en memoria para evitar saturar el HDD de la Raspberry Pi con lecturas constantes
let videoCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 300000; // 5 minutos

function isVideo(file) {
  return ['.mp4', '.mkv', '.avi'].includes(path.extname(file).toLowerCase());
}

function isImage(file) {
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(file).toLowerCase());
}

/**
 * Escanea recursivamente un directorio y devuelve estructura de árbol.
 */
function scanDirectory(dirPath) {
  const result = {
    folders: {},
    videos: [],
    thumbnails: []
  };

  const items = fs.readdirSync(dirPath);

  items.forEach(item => {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      const subDirResult = scanDirectory(itemPath);
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

  return result;
}

/**
 * Entregará todas las Categorías > Series > Árbol Recursivo
 */
function getVideos() {
  const now = Date.now();
  if (videoCache && (now - lastCacheTime < CACHE_TTL)) {
    return videoCache;
  }

  const videos = {};

  categories.forEach(category => {
    const categoryPath = path.join(videoFolder, category);

    if (!fs.existsSync(categoryPath)) {
      return;
    }

    const subcategories = fs.readdirSync(categoryPath);

    subcategories.forEach(subcategory => {
      const subcategoryPath = path.join(categoryPath, subcategory);
      if (fs.statSync(subcategoryPath).isDirectory()) {
        const content = scanDirectory(subcategoryPath);
        if (content.videos.length > 0 || Object.keys(content.folders).length > 0) {
          videos[category] = videos[category] || {};
          videos[category][subcategory] = content;
        }
      }
    });
  });

  videoCache = videos;
  lastCacheTime = now;
  return videos;
}

module.exports = { getVideos };
