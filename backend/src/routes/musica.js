const express = require('express');
const router = express.Router();

const controller = require('../controllers/musica');

// Ruta para listar los archivos de audio
router.get('/musica', (req, res) => {
  const musica = controller.getMusicas();
  res.json(musica);
});

module.exports = router;