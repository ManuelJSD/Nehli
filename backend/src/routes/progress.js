const express = require('express');
const { createHash } = require('node:crypto');
const { sequelize } = require('../config/mysql');
const WatchProgress = require('../models/watchProgress');
const session = require('../middleware/session');

const router = express.Router();

function episodeKey(path) {
    if (typeof path !== 'string' || !path || path.length > 4096 || Buffer.from(path, 'base64').toString('base64') !== path) return;
    return createHash('sha256').update(path).digest('hex');
}

router.use(session, (req, res, next) => {
    if (!req.user) return res.sendStatus(401);
    res.set('Cache-Control', 'no-store');
    next();
});

router.get('/', async (req, res, next) => {
    try {
        const where = { account_id: req.user.id };
        const attributes = [['episode_path', 'path'], 'position', 'duration', 'completed'];
        if (req.query.path !== undefined) {
            const key = episodeKey(req.query.path);
            if (!key) return res.sendStatus(400);
            const progress = await WatchProgress.findOne({ where: { ...where, episode_key: key }, attributes });
            return res.json(progress);
        }
        const progress = await WatchProgress.findAll({
            where: { ...where, completed: false }, attributes,
            order: [['observed_at', 'DESC']], limit: 50
        });
        res.json(progress);
    } catch (error) {
        next(error);
    }
});

router.put('/', async (req, res, next) => {
    const { path, position, duration, completed, observedAt } = req.body || {};
    const key = episodeKey(path);
    if (!key || !Number.isFinite(position) || position < 0 ||
        !Number.isFinite(duration) || duration <= 0 || position > duration ||
        typeof completed !== 'boolean' || !Number.isSafeInteger(observedAt) || observedAt <= 0) {
        return res.sendStatus(400);
    }
    try {
        // Pause, navigation and page teardown can send overlapping updates.
        // Keep the latest player event even if the requests arrive out of order.
        await sequelize.query(`
            INSERT INTO watch_progress
                (account_id, episode_key, episode_path, position, duration, completed, observed_at)
            VALUES ($account, $key, $path, $position, $duration, $completed, $observedAt)
            ON DUPLICATE KEY UPDATE
                position = IF(observed_at <= VALUES(observed_at), VALUES(position), position),
                duration = IF(observed_at <= VALUES(observed_at), VALUES(duration), duration),
                completed = IF(observed_at <= VALUES(observed_at), VALUES(completed), completed),
                observed_at = GREATEST(observed_at, VALUES(observed_at))
        `, { bind: {
            account: req.user.id, key, path, position, duration, completed,
            observedAt: Math.min(observedAt, Date.now())
        } });
        res.sendStatus(204);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
