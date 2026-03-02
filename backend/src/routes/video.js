const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/session');
const controller = require('../controllers/video');
const thumbnailController = require('../controllers/thumbnail');

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
router.get('/videos', authMiddleware, async (req, res) => {
  try {
    const videos = await controller.getVideos();
    res.json(videos);
  } catch (error) {
    console.error('Error al obtener videos:', error);
    res.status(500).json({ error: 'Error al obtener el catálogo de videos.' });
  }
});

/**
 * @swagger
 * /video/thumbnail:
 *   get:
 *     summary: Obtiene una redirección a la portada de un título externo
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: title
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       302:
 *         description: Redirección a la imagen original
 *       404:
 *         description: No se encontró la imagen
 */
router.get('/thumbnail', thumbnailController.getThumbnail);

module.exports = router;