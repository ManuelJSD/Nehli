const { randomBytes, randomInt, timingSafeEqual } = require('node:crypto');

const pending = new Map();
const lifetime = 5 * 60 * 1000;
const maximum = 2500;
const glyphs = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgecd', 'abc', 'abcdefg', 'abfgcd'];
const segments = {
    a: [2, 1, 14, 1], b: [15, 2, 15, 12], c: [15, 15, 15, 25],
    d: [2, 26, 14, 26], e: [1, 15, 1, 25], f: [1, 2, 1, 12], g: [2, 13.5, 14, 13.5]
};

function renderCode(code) {
    const width = 144;
    const height = 50;
    const stride = width * 3;
    const bmp = Buffer.alloc(54 + stride * height, 232);
    bmp.fill(0, 0, 54);
    bmp.write('BM');
    bmp.writeUInt32LE(bmp.length, 2);
    bmp.writeUInt32LE(54, 10);
    bmp.writeUInt32LE(40, 14);
    bmp.writeInt32LE(width, 18);
    bmp.writeInt32LE(height, 22);
    bmp.writeUInt16LE(1, 26);
    bmp.writeUInt16LE(24, 28);

    function stroke(x1, y1, x2, y2, shade, radius) {
        const steps = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))) || 1;
        for (let step = 0; step <= steps; step++) {
            const x = Math.round(x1 + (x2 - x1) * step / steps);
            const y = Math.round(y1 + (y2 - y1) * step / steps);
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
                    const offset = 54 + (height - 1 - y - dy) * stride + (x + dx) * 3;
                    bmp.fill(shade, offset, offset + 3);
                }
            }
        }
    }

    for (let line = 0; line < 11; line++) {
        stroke(0, randomInt(height), width - 1, randomInt(height), randomInt(115, 198), 0);
    }
    Array.from(code).forEach((digit, index) => {
        const x = 14 + index * 25 + randomInt(-3, 4);
        const y = randomInt(9, 16);
        const slant = randomInt(-28, 29) / 100;
        for (const edge of glyphs[Number(digit)]) {
            const [x1, y1, x2, y2] = segments[edge];
            stroke(x + x1 + slant * y1, y + y1, x + x2 + slant * y2, y + y2, randomInt(16, 67), 1);
        }
    });
    return 'data:image/bmp;base64,' + bmp.toString('base64');
}

function challenge(req, res) {
    const now = Date.now();
    for (const [id, value] of pending) {
        if (value.expires > now) break;
        pending.delete(id);
    }
    if (pending.size >= maximum) pending.delete(pending.keys().next().value);

    const id = randomBytes(24).toString('hex');
    const code = String(randomInt(10000, 100000));
    pending.set(id, { code, ip: req.ip, expires: now + lifetime });
    res.set('Cache-Control', 'no-store').json({ id, image: renderCode(code) });
}

function verifyChallenge(req, res, next) {
    const { challengeId, challengeAnswer } = req.body || {};
    const entry = pending.get(challengeId);
    if (entry?.ip === req.ip) pending.delete(challengeId);
    if (!entry || entry.ip !== req.ip || entry.expires <= Date.now() ||
        typeof challengeAnswer !== 'string' || !/^\d{5}$/.test(challengeAnswer) ||
        !timingSafeEqual(Buffer.from(challengeAnswer), Buffer.from(entry.code))) {
        return res.status(400).json({ error: 'El código de verificación es incorrecto o ha caducado. Prueba con uno nuevo.' });
    }
    next();
}

module.exports = { challenge, verifyChallenge };
