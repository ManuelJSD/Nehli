const express = require('express');
const router = express.Router();
const streamController = require('../controllers/stream');

/**
 * @swagger
 * /stream/{category}/{subcategory}/{video}:
 *   get:
 *     summary: Inicia el stream de video, convierte MKV a MP4 al vuelo si es necesario.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *       - in: path
 *         name: subcategory
 *         required: true
 *       - in: path
 *         name: video
 *         required: true
 *     responses:
 *       200:
 *         description: Stream de video web compatible
 *       206:
 *         description: Fragmento de video (Partial Content)
 *       404:
 *         description: Video no encontrado
 */
router.get('/play', streamController.streamVideo);

/**
 * @swagger
 * /stream/metadata/{category}/{subcategory}/{video}:
 *   get:
 *     summary: Obtiene los metadatos de las pistas de audio y subtítulos de un archivo.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *       - in: path
 *         name: subcategory
 *         required: true
 *       - in: path
 *         name: video
 *         required: true
 *     responses:
 *       200:
 *         description: Lista de pistas de audio y subtítulos
 */
router.get('/metadata', streamController.getVideoMetadata);

/**
 * @swagger
 * /stream/subtitle/{category}/{subcategory}/{video}/{trackIndex}:
 *   get:
 *     summary: Extrae una pista de subtítulo del MKV y la sirve como WebVTT al vuelo.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *       - in: path
 *         name: subcategory
 *         required: true
 *       - in: path
 *         name: video
 *         required: true
 *       - in: path
 *         name: trackIndex
 *         required: true
 *     responses:
 *       200:
 *         description: Archivo WebVTT
 *         content:
 *           text/vtt:
 *             schema:
 *               type: string
 */
router.get('/subtitle', streamController.getSubtitle);

module.exports = router;
