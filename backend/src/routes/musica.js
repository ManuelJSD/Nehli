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

module.exports = router;
