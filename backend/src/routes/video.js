const express = require('express');
const router = express.Router();

const controller = require('../controllers/video');

/**
 * @swagger
 * tags:
 *   name: Videos
 *   description: API para obtener información de videos
 */

/**
 * @swagger
 * /videos:
 *   get:
 *     summary: Obtiene todos los videos
 *     tags: [Videos]
 *     responses:
 *       200:
 *         description: Lista de todos los videos
 */

router.get('/videos', (req, res) => {
  const videos = controller.getVideos();
  res.json(videos);
});

module.exports = router;