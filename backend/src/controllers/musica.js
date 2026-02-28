const path = require('path');
const fs = require('fs');

const rutaCarpetaMusica = '\\\\192.168.1.12\\home\\Musica';

function getMusicas(){
  const archivosAudio = [];
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
};


function esArchivoDeAudio(archivo) {
  const extension = path.extname(archivo).toLowerCase();
  return extension === '.mp3' || extension === '.wav' || extension === '.m4a';
}

module.exports = {
    getMusicas
};