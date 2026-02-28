const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/session');
const controller = require('../controllers/musica');

/**
 * @swagger
 * tags:
 *   name: Música
 *   description: API para obtener el listado de archivos de música del servidor multimedia
 */

/**
 * @swagger
 * /musica/musica:
 *   get:
 *     summary: Obtiene el listado de archivos de música
 *     tags: [Música]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Devuelve los archivos de audio disponibles en la carpeta configurada.
 *       Requiere autenticación.
 *     responses:
 *       200:
 *         description: Listado de archivos de música
 *       401:
 *         description: No autenticado
 */
router.get('/musica', authMiddleware, (req, res) => {
  try {
    const musica = controller.getMusicas();
    res.json(musica);
  } catch (error) {
    console.error('Error al obtener música:', error);
    res.status(500).json({ error: 'Error al obtener el catálogo de música.' });
  }
});

module.exports = router;