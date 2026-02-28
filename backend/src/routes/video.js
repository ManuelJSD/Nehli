const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/session');
const controller = require('../controllers/video');

/**
 * @swagger
 * tags:
 *   name: Videos
 *   description: API para obtener información de videos del servidor multimedia
 */

/**
 * @swagger
 * /video/videos:
 *   get:
 *     summary: Obtiene el catálogo completo de videos
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Devuelve la estructura de categorías y subcategorías con los archivos
 *       de video y thumbnails disponibles. Requiere autenticación.
 *     responses:
 *       200:
 *         description: Catálogo de videos
 *       401:
 *         description: No autenticado
 */
router.get('/videos', authMiddleware, (req, res) => {
  try {
    const videos = controller.getVideos();
    res.json(videos);
  } catch (error) {
    console.error('Error al obtener videos:', error);
    res.status(500).json({ error: 'Error al obtener el catálogo de videos.' });
  }
});

module.exports = router;