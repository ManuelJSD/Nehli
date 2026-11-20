const express = require('express');
const { createHash } = require('node:crypto');
const session = require('../middleware/session');
const { requireCategory } = require('../utils/accessPolicy');
const TrackPreferences = require('../models/trackPreferences');

const router = express.Router();
router.use(session, requireCategory, (req, res, next) => {
    if (!req.user) return res.sendStatus(401);
    const { category, title } = req.query;
    if (![category, title].every(value => typeof value === 'string' && value.length > 0 && value.length <= 512)) {
        return res.sendStatus(400);
    }
    req.seriesKey = createHash('sha256').update(JSON.stringify([category, title])).digest('hex');
    res.set('Cache-Control', 'no-store');
    next();
});

router.get('/', async (req, res, next) => {
    try {
        const rows = await TrackPreferences.findAll({
            where: { account_id: req.user.id, series_key: req.seriesKey },
            attributes: ['kind', 'preference']
        });
        res.json(Object.fromEntries(rows.map(row => [row.kind, typeof row.preference === 'string' ? JSON.parse(row.preference) : row.preference])));
    } catch (error) {
        next(error);
    }
});

router.put('/', async (req, res, next) => {
    const { kind, preference } = req.body || {};
    if (!['audio', 'subtitle'].includes(kind)) return res.sendStatus(400);
    let value;
    if (preference?.off === true && kind === 'subtitle') {
        value = { off: true };
    } else {
        const { language, title, codec, index, image } = preference || {};
        if (![language, title, codec].every(text => typeof text === 'string' && text.length <= 512) ||
            !Number.isSafeInteger(index) || index < 0 || typeof image !== 'boolean') return res.sendStatus(400);
        value = { language, title, codec, index, image };
    }
    try {
        await TrackPreferences.upsert({
            account_id: req.user.id, series_key: req.seriesKey, kind, preference: value
        });
        res.sendStatus(204);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
