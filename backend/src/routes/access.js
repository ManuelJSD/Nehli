const express = require('express');
const { cuentasModel } = require('../models');
const { sequelize } = require('../config/mysql');
const MusicAccess = require('../models/musicAccess');
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
        const [settings, policies, catalog, music] = await Promise.all([
            Policy.findByPk(0), Policy.findAll(), getVideos(), MusicAccess.findAll()
        ]);
        const accounts = Object.fromEntries(policies.filter(row => row.accountId !== 0)
            .map(row => [row.accountId, { pending: row.pending, deniedCategories: deniedCategories(row) }]));
        for (const row of music) {
            accounts[row.accountId] ??= { pending: false, deniedCategories: [] };
            accounts[row.accountId].musicAllowed = row.allowed;
        }
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
        key === 'musicAllowed' && typeof input.musicAllowed === 'boolean' ||
        key === 'deniedCategories' && Array.isArray(input.deniedCategories) && input.deniedCategories.length <= 512 &&
        input.deniedCategories.every(category => typeof category === 'string' && category.length > 0 && category.length <= 512));
    if (!Number.isSafeInteger(id) || id <= 0 || !keys.length || !valid) return res.sendStatus(400);
    try {
        const status = await sequelize.transaction(async transaction => {
            const account = await cuentasModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!account) return 404;
            if (account.role === 'admin') return 409;
            const { musicAllowed, ...policy } = input;
            const fields = Object.keys(policy);
            if (fields.length) {
                if (policy.deniedCategories) policy.deniedCategories = [...new Set(policy.deniedCategories)];
                const [record] = await Policy.findOrCreate({ where: { accountId: id }, transaction });
                await record.update(policy, { fields, transaction });
            }
            if (musicAllowed !== undefined) {
                await MusicAccess.upsert({ accountId: id, allowed: musicAllowed }, { transaction });
            }
            return 204;
        });
        if (status === 409) return res.status(409).json({ error: 'Las cuentas administradoras conservan el acceso completo.' });
        res.sendStatus(status);
    } catch (error) { next(error); }
});

module.exports = router;
