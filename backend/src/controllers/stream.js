const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

const videoFolder = path.resolve(process.env.VIDEO_FOLDER || './videos');
const segmentLength = 6;
const probeCache = new Map();
const subtitleCache = new Map();
const maxSubtitleCacheEntries = 64;
const maxSubtitleCacheBytes = 16 * 1024 * 1024;
let subtitleCacheBytes = 0;
const imageSubtitles = new Set(['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle', 'xsub']);

function httpError(status, message) {
    return Object.assign(new Error(message), { status });
}

function parseIndex(value, label) {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw httpError(400, label + ' no válido');
    }
    return Number(value);
}

async function findVideo(encodedPath) {
    if (typeof encodedPath !== 'string' || !encodedPath) {
        throw httpError(400, 'Falta el path del video');
    }

    const relativePath = Buffer.from(encodedPath, 'base64').toString('utf8');
    if (!relativePath || relativePath.includes('\0') || path.isAbsolute(relativePath)) {
        throw httpError(403, 'Ruta no permitida');
    }
    const filename = path.resolve(videoFolder, relativePath);
    if (!isInside(videoFolder, filename)) throw httpError(403, 'Ruta no permitida');

    try {
        const realFolder = await fs.realpath(videoFolder);
        const realFilename = await fs.realpath(filename);
        if (!isInside(realFolder, realFilename)) throw httpError(403, 'Ruta no permitida');
        const stat = await fs.stat(realFilename);
        if (!stat.isFile()) throw httpError(404, 'Video no encontrado');
        return { filename: realFilename, version: stat.mtimeMs + ':' + stat.size };
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') throw httpError(404, 'Video no encontrado');
        throw error;
    }
}

function isInside(folder, filename) {
    const relative = path.relative(folder, filename);
    return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function runMediaTool(command, args, { res, passthrough = false } = {}) {
    const executable = process.env[command.toUpperCase() + '_PATH'] || command;
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const chunks = [];
        let stderr = '';
        let bytes = 0;
        const cancel = () => child.kill();
        res?.once('close', cancel);
        if (res?.destroyed) cancel();

        child.stderr.on('data', data => {
            stderr = (stderr + data.toString()).slice(-4000);
        });
        if (passthrough) {
            child.stdout.pipe(res, { end: false });
        } else {
            child.stdout.on('data', data => {
                bytes += data.length;
                if (bytes > 32 * 1024 * 1024) {
                    cancel();
                    reject(httpError(422, 'La salida multimedia supera el tamaño admitido'));
                } else {
                    chunks.push(data);
                }
            });
        }

        child.once('error', error => {
            res?.off('close', cancel);
            reject(httpError(503, 'No se pudo ejecutar ' + command + ': ' + error.message));
        });
        child.once('close', code => {
            res?.off('close', cancel);
            if (code === 0 && (passthrough || bytes > 0)) {
                resolve(Buffer.concat(chunks));
            } else {
                reject(httpError(422, stderr.trim() || 'No se pudo procesar el archivo multimedia'));
            }
        });
    });
}

async function probeVideo({ filename, version }) {
    const previous = probeCache.get(filename);
    if (previous?.version === version) return previous.result;

    const result = runMediaTool('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file', '-show_format', '-show_streams', '-of', 'json', filename])
        .then(buffer => {
            const probe = JSON.parse(buffer.toString('utf8'));
            const video = probe.streams.find(stream => stream.codec_type === 'video' && !stream.disposition?.attached_pic);
            if (!video) throw httpError(422, 'El archivo no contiene una pista de video');

            const audioStreams = probe.streams.filter(stream => stream.codec_type === 'audio');
            const subtitleStreams = probe.streams.filter(stream => stream.codec_type === 'subtitle');
            const audios = audioStreams.map((stream, index) => trackMetadata(stream, index, 'Audio'));
            const subtitles = subtitleStreams.map((stream, index) => ({
                ...trackMetadata(stream, index, 'Subtítulo'),
                image: imageSubtitles.has(stream.codec_name)
            }));
            const duration = getDuration(video, probe.format);
            const directPlay = ['.mp4', '.m4v'].includes(path.extname(filename).toLowerCase()) &&
                probe.format?.format_name?.split(',').includes('mp4') &&
                video.codec_name === 'h264' && video.pix_fmt === 'yuv420p' &&
                !probe.streams.some(stream => stream.codec_type === 'video' && stream !== video) &&
                audioStreams.length <= 1 && audioStreams.every(stream => stream.codec_name === 'aac' && stream.profile === 'LC');

            return {
                video, audioStreams, subtitleStreams, audios, subtitles, duration, directPlay,
                startTime: Number(probe.format?.start_time) || 0,
                bitmapTimelines: new Map()
            };
        })
        .catch(error => {
            if (probeCache.get(filename)?.result === result) probeCache.delete(filename);
            throw error;
        });

    probeCache.delete(filename);
    if (probeCache.size >= 64) probeCache.delete(probeCache.keys().next().value);
    probeCache.set(filename, { version, result });
    return result;
}

function getDuration(video, format) {
    const streamDuration = Number(video.duration);
    if (Number.isFinite(streamDuration) && streamDuration > 0) return streamDuration;

    let containerDuration = Number(format?.duration);
    if (format?.format_name === 'matroska,webm') {
        // Matroska timestamps can start above zero, while FFmpeg playback starts at zero.
        const tag = Object.entries(video.tags || {}).find(([key]) => key.toUpperCase() === 'DURATION')?.[1];
        const match = tag?.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
        if (match) {
            const [, hours, minutes, seconds] = match.map(Number);
            containerDuration = hours * 3600 + minutes * 60 + seconds;
        }
        containerDuration -= Math.max(0, Number(format.start_time) || 0);
    }
    return Number.isFinite(containerDuration) && containerDuration > 0 ? containerDuration : 0;
}

function trackMetadata(stream, index, fallback) {
    return {
        index,
        language: stream.tags?.language || 'und',
        codec: stream.codec_name,
        title: stream.tags?.title || fallback + ' ' + (index + 1),
        default: stream.disposition?.default === 1
    };
}

function pickTracks(media, query) {
    const audio = parseIndex(query.audio, 'Índice de audio');
    const subtitle = parseIndex(query.subtitle, 'Índice de subtítulo');
    if (audio !== undefined && !media.audioStreams[audio]) throw httpError(404, 'Pista de audio no encontrada');
    if (subtitle !== undefined && !media.subtitles[subtitle]?.image) {
        throw httpError(404, 'Pista de subtítulo de imagen no encontrada');
    }

    const defaultAudio = media.audios.find(track => track.default)?.index ?? 0;
    return {
        audio: media.audioStreams[audio ?? defaultAudio],
        subtitle: media.subtitleStreams[subtitle]
    };
}

async function bitmapInputStart(file, media, subtitle, start) {
    if (!subtitle) return start;
    if (start <= 15) return 0;

    // A bitmap can stay on screen across segment boundaries until a clear event.
    // Index subtitle frames once so long cues don't require a fixed seek window.
    const index = subtitle.index;
    if (!media.bitmapTimelines.has(index)) {
        const timeline = runMediaTool('ffprobe', [
            '-v', 'error', '-protocol_whitelist', 'file', '-select_streams', String(index), '-show_frames',
            '-show_entries', 'frame=pts_time,start_display_time,end_display_time,num_rects', '-of', 'json', file.filename
        ]).then(buffer => {
            const { frames = [] } = JSON.parse(buffer.toString('utf8'));
            return frames.flatMap(frame => {
                const timestamp = Number(frame.pts_time) - media.startTime;
                if (!Number.isFinite(timestamp)) return [];
                const startTime = timestamp + frame.start_display_time / 1000;
                const endTime = frame.end_display_time === 0xffffffff
                    ? Infinity : timestamp + frame.end_display_time / 1000;
                return [{ timestamp, startTime, endTime, visible: frame.num_rects > 0 }];
            }).sort((a, b) => a.startTime - b.startTime);
        }).catch(error => {
            media.bitmapTimelines.delete(index);
            console.warn('No se pudo indexar el subtítulo de imagen:', error.message);
            return undefined;
        });
        media.bitmapTimelines.set(index, timeline);
    }

    const frames = await media.bitmapTimelines.get(index);
    if (!frames) return start - 15;
    for (let index = frames.length - 1; index >= 0; index--) {
        const frame = frames[index];
        if (frame.startTime <= start) {
            return frame.visible && frame.endTime > start ? Math.max(0, frame.timestamp - 1) : start;
        }
    }
    return start;
}

function transcodeArgs(filename, video, tracks, inputStart, start, duration) {
    const scale = "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2";
    const args = [
        '-hide_banner', '-loglevel', 'error',
        ...(inputStart > 0 ? ['-ss', String(inputStart)] : []),
        '-protocol_whitelist', 'file', '-i', filename,
        ...(start > inputStart ? ['-ss', String(start - inputStart)] : []),
        ...(duration === undefined ? [] : ['-t', String(duration)]),
    ];

    if (tracks.subtitle) {
        const fitSubtitle = video.width && video.height
            ? '[0:' + tracks.subtitle.index + ']scale=' + video.width + ':' + video.height + '[subtitle];'
            : '';
        const subtitleInput = fitSubtitle ? '[subtitle]' : '[0:' + tracks.subtitle.index + ']';
        args.push('-filter_complex_threads', '2', '-filter_complex',
            fitSubtitle + '[0:' + video.index + ']' + subtitleInput + 'overlay=eof_action=pass,' + scale + '[video]',
            '-map', '[video]');
    } else {
        args.push('-map', '0:' + video.index, '-filter_threads', '2', '-vf', scale);
    }

    if (tracks.audio) {
        args.push('-map', '0:' + tracks.audio.index, '-c:a', 'aac', '-ac', '2', '-ar', '48000', '-b:a', '160k',
            '-af', 'aresample=async=1:first_pts=0,apad', '-shortest');
    }
    return args.concat('-c:v', 'libx264', '-threads:v', '2', '-preset', 'ultrafast', '-crf', '22', '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p');
}

function mediaHandler(handler) {
    return async (req, res, next) => {
        try {
            const file = await findVideo(req.query.path);
            const media = await probeVideo(file);
            if (!res.destroyed) await handler(req, res, file, media, next);
        } catch (error) {
            if (res.destroyed) return;
            if (res.headersSent) return res.destroy(error);
            if (!error.status) console.error('Error procesando el video:', error);
            res.removeHeader('Content-Type');
            res.status(error.status || 500).json({ error: error.status ? error.message : 'Error procesando el video' });
        }
    };
}

const getVideoMetadata = mediaHandler((req, res, file, { audios, subtitles, directPlay, duration }) => {
    res.json({ audios, subtitles, directPlay, duration });
});

const getVideoDuration = mediaHandler((req, res, file, { duration }) => res.json({ duration }));

function trimSubtitleCache(additionalEntries = 0) {
    for (const [key, entry] of subtitleCache) {
        if (subtitleCache.size + additionalEntries <= maxSubtitleCacheEntries &&
            subtitleCacheBytes <= maxSubtitleCacheBytes) return;
        // Keep an in-flight extraction available to other requests for the same track.
        if (entry.bytes === undefined) continue;
        subtitleCache.delete(key);
        subtitleCacheBytes -= entry.bytes;
    }
}

function loadSubtitle(file, streamIndex, res, preview) {
    const fullKey = JSON.stringify([file.filename, file.version, streamIndex, false]);
    const full = preview && subtitleCache.get(fullKey);
    if (full && full.bytes !== undefined) return full.output;

    const key = JSON.stringify([file.filename, file.version, streamIndex, preview]);
    const cached = subtitleCache.get(key);
    if (cached) {
        subtitleCache.delete(key);
        subtitleCache.set(key, cached);
        return cached.output;
    }

    trimSubtitleCache(1);
    const entry = subtitleCache.size < maxSubtitleCacheEntries ? {} : undefined;
    const output = runMediaTool('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file', '-i', file.filename,
        ...(preview ? ['-t', '120'] : []),
        '-map', '0:' + streamIndex, '-c:s', 'webvtt', '-f', 'webvtt', 'pipe:1'
    ], entry ? {} : { res }).then(buffer => {
        const cueTiming = /^(?:\d{2,}:)?\d{2}:\d{2}\.\d{3}[ \t]+-->[ \t]+(?:\d{2,}:)?\d{2}:\d{2}\.\d{3}(?:[ \t].*)?\r?$/m;
        if (!preview && !cueTiming.test(buffer.toString('utf8'))) {
            throw httpError(422, 'La pista no contiene subtítulos de texto');
        }
        if (entry) {
            if (buffer.length <= maxSubtitleCacheBytes) {
                entry.bytes = buffer.length;
                subtitleCacheBytes += entry.bytes;
                trimSubtitleCache();
            } else {
                subtitleCache.delete(key);
            }
        }
        return buffer;
    }).catch(error => {
        if (entry) subtitleCache.delete(key);
        throw error;
    });

    if (entry) {
        entry.output = output;
        subtitleCache.set(key, entry);
    }
    return output;
}


const getSubtitle = mediaHandler(async (req, res, file, media) => {
    const index = parseIndex(req.query.trackIndex, 'Índice de subtítulo');
    if (index === undefined) throw httpError(400, 'Falta el índice de subtítulo');
    const track = media.subtitles[index];
    if (!track) throw httpError(404, 'Pista de subtítulo no encontrada');
    if (track.image) throw httpError(415, 'Esta pista se reproduce sobre la imagen');

    const output = await loadSubtitle(file, media.subtitleStreams[index].index, res, req.query.preview === '1');
    if (!res.destroyed) res.type('text/vtt; charset=utf-8').send(output);
});

const getPlaylist = mediaHandler((req, res, file, media) => {
    pickTracks(media, req.query);
    if (!media.duration) throw httpError(422, 'No se pudo determinar la duración del video');

    const lines = [
        '#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-PLAYLIST-TYPE:VOD',
        '#EXT-X-TARGETDURATION:' + segmentLength, '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-INDEPENDENT-SEGMENTS'
    ];
    const query = new URLSearchParams({ path: req.query.path });
    for (const key of ['audio', 'subtitle']) {
        if (req.query[key] !== undefined) query.set(key, req.query[key]);
    }
    for (let segment = 0; segment * segmentLength < media.duration; segment++) {
        const length = Math.min(segmentLength, media.duration - segment * segmentLength);
        // FFmpeg starts a new transport-stream timeline for each independently seekable segment.
        if (segment > 0) lines.push('#EXT-X-DISCONTINUITY');
        query.set('segment', String(segment));
        lines.push('#EXTINF:' + length.toFixed(6) + ',', 'segment?' + query.toString());
    }
    res.type('application/vnd.apple.mpegurl').send(lines.concat('#EXT-X-ENDLIST', '').join('\n'));
});

const getSegment = mediaHandler(async (req, res, file, media) => {
    const segment = parseIndex(req.query.segment, 'Índice de segmento');
    if (segment === undefined) throw httpError(400, 'Falta el índice de segmento');
    const start = segment * segmentLength;
    if (start >= media.duration) throw httpError(404, 'Segmento no encontrado');

    const tracks = pickTracks(media, req.query);
    const inputStart = await bitmapInputStart(file, media, tracks.subtitle, start);
    const args = transcodeArgs(file.filename, media.video, tracks, inputStart, start, Math.min(segmentLength, media.duration - start));
    const output = await runMediaTool('ffmpeg', args.concat('-f', 'mpegts', 'pipe:1'), { res });
    if (!res.destroyed) res.type('video/mp2t').send(output);
});

const streamVideo = mediaHandler(async (req, res, file, media, next) => {
    const start = req.query.start === undefined ? 0 : Number(req.query.start);
    if (Array.isArray(req.query.start) || !Number.isFinite(start) || start < 0) {
        throw httpError(400, 'Tiempo de inicio no válido');
    }
    const tracks = pickTracks(media, req.query);
    if (media.directPlay && start === 0 && !tracks.subtitle) {
        res.type('video/mp4').sendFile(file.filename, error => {
            if (error && !res.destroyed) next(error);
        });
        return;
    }

    const inputStart = await bitmapInputStart(file, media, tracks.subtitle, start);
    const args = transcodeArgs(file.filename, media.video, tracks, inputStart, start);
    res.type('video/mp4');
    await runMediaTool('ffmpeg', args.concat('-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4', 'pipe:1'), { res, passthrough: true });
    if (!res.destroyed) res.end();
});

module.exports = { streamVideo, getVideoMetadata, getSubtitle, getVideoDuration, getPlaylist, getSegment };
