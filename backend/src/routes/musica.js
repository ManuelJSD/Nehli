const express = require('express');
const router = express.Router();
const session = require('../middleware/session');
const { canAccessMusic, requireMusic, setMediaCookie } = require('../utils/accessPolicy');
const { notePlayback } = require('../utils/metadataCache');
const controller = require('../controllers/musica');

router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
});

router.get('/access', session, async (req, res, next) => {
    try { res.json({ allowed: await canAccessMusic(req.user) }); }
    catch (error) { next(error); }
});
router.get('/catalog', session, requireMusic, (req, res) => {
    setMediaCookie(req, res);
    controller.getCatalog(req, res);
});
router.get('/musica', session, requireMusic, async (req, res, next) => {
    try { res.json(await controller.getMusicas()); }
    catch (error) { next(error); }
});
router.get('/artwork/:id', session.mediaSession, requireMusic, controller.sendArtwork);
router.get('/track/:id', session.mediaSession, requireMusic, notePlayback, controller.playTrack);

const Collections = require('../models/musicCollection');
const { randomUUID } = require('node:crypto');
const validTrack = id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);
const validList = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);

router.get('/collection', session, requireMusic, async (req, res, next) => {
    try {
        const rows = await Collections.findAll({ where: { accountId: req.user.id } });
        res.json({
            favorites: rows.filter(row => row.kind === 'favorite').map(row => row.id),
            playlists: rows.filter(row => row.kind === 'playlist').map(row => ({
                id: row.id, name: row.name, tracks: typeof row.tracks === 'string' ? JSON.parse(row.tracks) : row.tracks
            }))
        });
    } catch (error) { next(error); }
});

router.put('/favorites/:id', session, requireMusic, async (req, res, next) => {
    const { id } = req.params;
    if (!validTrack(id) || typeof req.body?.favorite !== 'boolean') return res.sendStatus(400);
    try {
        const row = { accountId: req.user.id, id, kind: 'favorite' };
        if (req.body.favorite) await Collections.upsert(row);
        else await Collections.destroy({ where: row });
        res.sendStatus(204);
    } catch (error) { next(error); }
});

router.put('/playlists/:id', session, requireMusic, async (req, res, next) => {
    const { id } = req.params;
    const { name, tracks } = req.body || {};
    if ((id !== 'new' && !validList(id)) || typeof name !== 'string' || !name.trim() || name.length > 100 ||
        !Array.isArray(tracks) || !tracks.length || tracks.length > 1000 || !tracks.every(validTrack)) return res.sendStatus(400);
    try {
        const accountId = req.user.id;
        const playlist = { id: id === 'new' ? randomUUID() : id, name: name.trim(), tracks };
        if (id === 'new') await Collections.create({ ...playlist, accountId, kind: 'playlist' });
        else {
            const list = await Collections.findOne({ where: { accountId, id, kind: 'playlist' } });
            if (!list) return res.sendStatus(404);
            await list.update({ name: playlist.name, tracks });
        }
        res.json(playlist);
    } catch (error) { next(error); }
});

module.exports = router;
