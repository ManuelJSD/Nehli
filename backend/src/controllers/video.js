const fs = require('fs');
const path = require('path');

/**
 * Carpeta raíz donde se organizan los videos por categoría.
 * Configurada mediante la variable de entorno VIDEO_FOLDER.
 * Categorías esperadas: Peliculas, Series, Animacion, Anime.
 */
const videoFolder = process.env.VIDEO_FOLDER || './videos';
const categories = ['Peliculas', 'Series', 'Animacion', 'Anime'];

/**
 * Lee el sistema de archivos y construye un objeto con la estructura
 * de categorías > subcategorías > { videos, thumbnails }.
 * 
 * NOTA: Usa operaciones síncronas del filesystem. Para producción con
 * alta carga, considerar migrar a versiones async con caché en memoria.
 * 
 * @returns {{ [categoria: string]: { [titulo: string]: { videos: string[], thumbnails: string[] } } }}
 */
function getVideos() {
  const videos = {};

  categories.forEach(category => {
    const categoryPath = path.join(videoFolder, category);

    // Si la carpeta de la categoría no existe, la omitimos sin crashear
    if (!fs.existsSync(categoryPath)) {
      console.warn(`Carpeta de categoría no encontrada: ${categoryPath}`);
      return;
    }

    const subcategories = fs.readdirSync(categoryPath);

    subcategories.forEach(subcategory => {
      const subcategoryPath = path.join(categoryPath, subcategory);
      const isDirectory = fs.statSync(subcategoryPath).isDirectory();

      if (isDirectory) {
        const files = fs.readdirSync(subcategoryPath);

        const videoFiles = files.filter(file =>
          ['.mp4', '.mkv', '.avi'].includes(path.extname(file).toLowerCase())
        );

        const thumbnailFiles = files.filter(file =>
          ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(file).toLowerCase())
        );

        if (videoFiles.length > 0) {
          videos[category] = videos[category] || {};
          videos[category][subcategory] = {
            videos: videoFiles,
            thumbnails: thumbnailFiles
          };
        }
      }
    });
  });

  return videos;
}

module.exports = { getVideos };
