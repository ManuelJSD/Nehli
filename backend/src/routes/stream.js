const express = require('express');
const stream = require('../controllers/stream');

const router = express.Router();
const { mediaSession } = require('../middleware/session');
router.use(mediaSession, (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
});
const { notePlayback } = require('../utils/metadataCache');

/**
 * @swagger
 * components:
 *   parameters:
 *     StreamPath:
 *       in: query
 *       name: path
 *       required: true
 *       description: Ruta relativa al catálogo, codificada en Base64.
 *       schema:
 *         type: string
 *     StreamAudio:
 *       in: query
 *       name: audio
 *       description: Índice de la pista de audio en los metadatos.
 *       schema:
 *         type: integer
 *         minimum: 0
 *     StreamImageSubtitle:
 *       in: query
 *       name: subtitle
 *       description: Índice del subtítulo de imagen que debe integrarse en el vídeo.
 *       schema:
 *         type: integer
 *         minimum: 0
 * paths:
 *   /stream/play:
 *     get:
 *       summary: Sirve un archivo MP4 compatible o genera un flujo MP4.
 *       tags: [Videos]
 *       parameters:
 *         - $ref: '#/components/parameters/StreamPath'
 *         - $ref: '#/components/parameters/StreamAudio'
 *         - $ref: '#/components/parameters/StreamImageSubtitle'
 *         - in: query
 *           name: start
 *           description: Posición inicial en segundos.
 *           schema:
 *             type: number
 *             minimum: 0
 *       responses:
 *         '200':
 *           description: Flujo MP4
 *         '206':
 *           description: Intervalo de bytes de un MP4 compatible
 *   /stream/playlist:
 *     get:
 *       summary: Lista HLS VOD para la combinación de pistas elegida.
 *       tags: [Videos]
 *       parameters:
 *         - $ref: '#/components/parameters/StreamPath'
 *         - $ref: '#/components/parameters/StreamAudio'
 *         - $ref: '#/components/parameters/StreamImageSubtitle'
 *       responses:
 *         '200':
 *           description: Lista HLS
 *   /stream/segment:
 *     get:
 *       summary: Genera el segmento indicado por la lista HLS.
 *       tags: [Videos]
 *       parameters:
 *         - $ref: '#/components/parameters/StreamPath'
 *         - $ref: '#/components/parameters/StreamAudio'
 *         - $ref: '#/components/parameters/StreamImageSubtitle'
 *         - in: query
 *           name: segment
 *           required: true
 *           schema:
 *             type: integer
 *             minimum: 0
 *       responses:
 *         '200':
 *           description: Segmento de vídeo MPEG-TS
 *   /stream/metadata:
 *     get:
 *       summary: Obtiene las pistas, la duración y la compatibilidad directa del vídeo.
 *       tags: [Videos]
 *       parameters:
 *         - $ref: '#/components/parameters/StreamPath'
 *       responses:
 *         '200':
 *           description: Metadatos del vídeo
 *   /stream/subtitle:
 *     get:
 *       summary: Extrae una pista de subtítulos de texto en WebVTT.
 *       tags: [Videos]
 *       parameters:
 *         - $ref: '#/components/parameters/StreamPath'
 *         - in: query
 *           name: trackIndex
 *           required: true
 *           schema:
 *             type: integer
 *             minimum: 0
 *       responses:
 *         '200':
 *           description: Subtítulos WebVTT
 *         '415':
 *           description: El subtítulo es una pista de imagen
 *   /stream/duration:
 *     get:
 *       summary: Obtiene la duración del vídeo en segundos.
 *       tags: [Videos]
 *       parameters:
 *         - $ref: '#/components/parameters/StreamPath'
 *       responses:
 *         '200':
 *           description: Duración en segundos
 */
router.get('/diagnostic', require('../middleware/rol')(['admin']), require('../utils/playbackDiagnostics').read);
router.get('/play', notePlayback, stream.streamVideo);
router.get('/playlist', stream.getPlaylist);
router.get('/segment', notePlayback, stream.getSegment);
router.get('/metadata', stream.getVideoMetadata);
router.get('/subtitle', stream.getSubtitle);
router.get('/duration', stream.getVideoDuration);

module.exports = router;
