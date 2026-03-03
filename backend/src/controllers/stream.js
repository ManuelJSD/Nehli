const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const videoFolder = process.env.VIDEO_FOLDER || './videos';

/**
 * Controlador para hacer remux (convertir contenedor a mp4 sin recodificar)
 * al vuelo.
 */
const streamVideo = (req, res) => {
    const encodedPath = req.query.path;
    if (!encodedPath) return res.status(400).send('Falta el path del video');

    const relativePath = Buffer.from(encodedPath, 'base64').toString('utf8');

    // Evitar ataques de Path Traversal
    if (relativePath.includes('..')) {
        return res.status(403).send('Ruta no permitida');
    }

    const videoPath = path.join(videoFolder, relativePath);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).send('Video no encontrado');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Solo remuxear si es MKV
    const isMkv = path.extname(videoPath).toLowerCase() === '.mkv';

    if (isMkv) {
        // Para MKV, haremos remux en vivo a un formato MP4 fragmentado
        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Connection': 'keep-alive',
            'Accept-Ranges': 'bytes'
        });

        const audioTrack = req.query.audio ? req.query.audio : '0'; // Por defecto la primera pista de audio (0:a:0)

        const ffmpegArgs = [
            '-i', videoPath,
            '-map', '0:v:0',               // Mapear solo el video principal
            '-map', `0:a:${audioTrack}`,   // Mapear solo el audio solicitado
            '-vcodec', 'copy',
            '-acodec', 'aac',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-f', 'mp4',
            'pipe:1' // Emitir por stdout
        ];

        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

        ffmpegProcess.stdout.pipe(res);

        ffmpegProcess.stderr.on('data', (data) => {
            // ffmpeg escupe info útil en stderr, lo ignoramos si es normal
        });

        ffmpegProcess.on('error', (err) => {
            console.error('Error al iniciar FFmpeg:', err.message);
        });

        ffmpegProcess.on('close', (code) => {
            console.log(`Proceso FFmpeg finalizado con código ${code}`);
            res.end();
        });

        // Cuando el cliente se desconecta (cierra el reproductor), limpiar
        req.on('close', () => {
            console.log('Cliente se desconectó, deteniendo ffmpeg');
            ffmpegProcess.kill('SIGKILL');
        });

    } else {
        // Archivo normal (MP4, WEBM), servir estándar con rangos HTTP
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(videoPath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(200, head);
            fs.createReadStream(videoPath).pipe(res);
        }
    }
};

/**
 * Extrae los metadatos de las pistas del archivo MKV usando ffprobe.
 */
const getVideoMetadata = (req, res) => {
    const encodedPath = req.query.path;
    if (!encodedPath) return res.status(400).json({ error: 'Falta el path del video' });

    const relativePath = Buffer.from(encodedPath, 'base64').toString('utf8');

    if (relativePath.includes('..')) {
        return res.status(403).json({ error: 'Ruta no permitida' });
    }

    const videoPath = path.join(videoFolder, relativePath);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video no encontrado' });
    }

    // Ejecutar ffprobe para extraer streams en formato JSON
    const ffprobeArgs = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        videoPath
    ];

    const ffprobe = spawn('ffprobe', ffprobeArgs);
    let output = '';

    ffprobe.stdout.on('data', (data) => {
        output += data.toString();
    });

    ffprobe.on('error', (err) => {
        console.error('Error procesando ffprobe:', err.message);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'ffprobe no está instalado o falló al ejecutarse', details: err.message });
        }
    });

    ffprobe.on('close', (code) => {
        if (code !== 0) {
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Error al extraer metadatos de ffprobe' });
            }
            return;
        }

        try {
            const metadata = JSON.parse(output);

            // Filtrar y mapear audios
            const audios = metadata.streams
                .filter(s => s.codec_type === 'audio')
                .map((s, index) => ({
                    index: index, // Índice relativo de audio (0, 1, 2...) usado por libavfilter 0:a:X
                    language: s.tags?.language || 'Desconocido',
                    codec: s.codec_name,
                    title: s.tags?.title || `Audio ${index + 1}`
                }));

            // Filtrar y mapear subtítulos
            const subtitles = metadata.streams
                .filter(s => s.codec_type === 'subtitle')
                .map((s, index) => ({
                    index: index, // Índice relativo de subtítulo (0, 1, 2...)
                    language: s.tags?.language || 'Desconocido',
                    codec: s.codec_name,
                    title: s.tags?.title || `Subtítulo ${index + 1}`
                }));

            res.json({ audios, subtitles });
        } catch (error) {
            res.status(500).json({ error: 'Error parseando metadata', details: error.message });
        }
    });
};

/**
 * Extrae una pista de subtítulo específica y la devuelve en formato WebVTT.
 */
const getSubtitle = (req, res) => {
    const encodedPath = req.query.path;
    const trackIndex = req.query.trackIndex;
    if (!encodedPath || trackIndex === undefined) return res.status(400).send('Faltan parámetros');

    const relativePath = Buffer.from(encodedPath, 'base64').toString('utf8');

    if (relativePath.includes('..')) {
        return res.status(403).send('Ruta no permitida');
    }

    const videoPath = path.join(videoFolder, relativePath);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).send('Video no encontrado');
    }

    res.writeHead(200, {
        'Content-Type': 'text/vtt',
        'Connection': 'keep-alive'
    });

    // -map 0:s:trackIndex escoge el n-ésimo subtítulo
    const ffmpegArgs = [
        '-i', videoPath,
        '-map', `0:s:${trackIndex}`,
        '-f', 'webvtt',
        '-c:s', 'webvtt', // Convertimos a webvtt sea cual sea la entrada
        'pipe:1'
    ];

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    ffmpegProcess.stdout.pipe(res);

    ffmpegProcess.on('error', (err) => {
        console.error('Error extrayendo subtítulo:', err.message);
        if (!res.headersSent) res.status(500).end();
    });

    req.on('close', () => {
        ffmpegProcess.kill('SIGKILL');
    });
};

module.exports = { streamVideo, getVideoMetadata, getSubtitle };
