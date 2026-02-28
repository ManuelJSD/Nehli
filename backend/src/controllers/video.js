const fs = require('fs');
const path = require('path');

// const videoFolder = './videos';
const videoFolder = "\\\\192.168.1.12\\home\\Torrents\\Completados"
const categories = [ "Peliculas", "Series", "Animacion", "Anime" ]

function getVideos() {
  const videos = {};

  categories.forEach(category => {
    const categoryPath = path.join(videoFolder, category);

    // Leer cada subcarpeta de la categoría
    const subcategories = fs.readdirSync(categoryPath);

    subcategories.forEach(subcategory => {
      const subcategoryPath = path.join(categoryPath, subcategory);

      // Verificar si es un directorio antes de leer su contenido
      const isDirectory = fs.statSync(subcategoryPath).isDirectory();

      if (isDirectory) {
        const files = fs.readdirSync(subcategoryPath);

        const videoFiles = files.filter(file => {
          const extension = path.extname(file);
          return ['.mp4', '.mkv', '.avi'].includes(extension);
        });

        const thumbnailFiles = files.filter(file => {
          const extension = path.extname(file);
          return ['.jpg', '.jpeg', '.png', '.gif'].includes(extension);
        });

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

module.exports = {
  getVideos
};
