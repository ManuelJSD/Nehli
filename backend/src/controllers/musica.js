const path = require('path');
const fs = require('fs');

/**
 * Carpeta raíz donde se almacena la biblioteca de música.
 * Configurada mediante la variable de entorno MUSIC_FOLDER.
 */
const rutaCarpetaMusica = process.env.MUSIC_FOLDER || './musica';

/**
 * Lee la carpeta de música y devuelve una lista plana de archivos de audio.
 * Explora un nivel de subcarpetas (artista/álbum).
 * 
 * NOTA: Usa operaciones síncronas del filesystem. Para producción con
 * alta carga, considerar migrar a versiones async con caché en memoria.
 * 
 * @returns {string[]} Lista de nombres de archivos de audio encontrados
 */
function getMusicas() {
  const archivosAudio = [];

  // Si la carpeta no existe, devolvemos lista vacía sin crashear
  if (!fs.existsSync(rutaCarpetaMusica)) {
    console.warn(`Carpeta de música no encontrada: ${rutaCarpetaMusica}`);
    return archivosAudio;
  }

  const carpetas = fs.readdirSync(rutaCarpetaMusica);

  carpetas.forEach((carpeta) => {
    const rutaCarpeta = path.join(rutaCarpetaMusica, carpeta);
    const stat = fs.statSync(rutaCarpeta);

    if (stat.isDirectory()) {
      const archivosCarpeta = fs.readdirSync(rutaCarpeta);
      archivosCarpeta.forEach((archivo) => {
        if (esArchivoDeAudio(archivo)) {
          archivosAudio.push(archivo);
        }
      });
    }
  });

  return archivosAudio;
}

/**
 * Comprueba si un nombre de archivo corresponde a un formato de audio soportado.
 * @param {string} archivo - Nombre del archivo a comprobar
 * @returns {boolean}
 */
function esArchivoDeAudio(archivo) {
  const extension = path.extname(archivo).toLowerCase();
  return ['.mp3', '.wav', '.m4a', '.flac', '.ogg'].includes(extension);
}

module.exports = { getMusicas };