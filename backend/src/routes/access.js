const express = require('express');
const { cuentasModel } = require('../models');
const session = require('../middleware/session');
const admin = require('../middleware/rol')(['admin']);
const { getVideos } = require('../controllers/video');
const { Policy, deniedCategories, mediaCookie, mediaCookieOptions } = require('../utils/accessPolicy');
const router = express.Router();

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.post('/logout', (req, res) => {
    res.clearCookie(mediaCookie, mediaCookieOptions);
    res.sendStatus(204);
});

router.get('/settings', session, admin, async (req, res, next) => {
    try {
        const [settings, policies, catalog] = await Promise.all([Policy.findByPk(0), Policy.findAll(), getVideos()]);
        const accounts = Object.fromEntries(policies.filter(row => row.accountId !== 0)
            .map(row => [row.accountId, { pending: row.pending, deniedCategories: deniedCategories(row) }]));
        res.json({ approvalRequired: settings?.approvalRequired ?? false, categories: Object.keys(catalog), accounts });
    } catch (error) { next(error); }
});

router.put('/settings', session, admin, async (req, res, next) => {
    const { approvalRequired } = req.body || {};
    if (typeof approvalRequired !== 'boolean') return res.sendStatus(400);
    try {
        await Policy.upsert({ accountId: 0, approvalRequired });
        res.sendStatus(204);
    } catch (error) { next(error); }
});

router.patch('/accounts/:id', session, admin, async (req, res, next) => {
    const id = Number(req.params.id);
    const input = req.body || {};
    const keys = Object.keys(input);
    const valid = keys.every(key => key === 'pending' && input.pending === false ||
        key === 'deniedCategories' && Array.isArray(input.deniedCategories) && input.deniedCategories.length <= 512 &&
        input.deniedCategories.every(category => typeof category === 'string' && category.length > 0 && category.length <= 512));
    if (!Number.isSafeInteger(id) || id <= 0 || !keys.length || !valid) return res.sendStatus(400);
    try {
        const account = await cuentasModel.findByPk(id);
        if (!account) return res.sendStatus(404);
        if (account.role === 'admin') return res.status(409).json({ error: 'Las cuentas administradoras conservan el acceso completo.' });
        const [policy] = await Policy.findOrCreate({ where: { accountId: id } });
        if (input.deniedCategories) input.deniedCategories = [...new Set(input.deniedCategories)];
        await policy.update(input, { fields: keys });
        res.sendStatus(204);
    } catch (error) { next(error); }
});

module.exports = router;
