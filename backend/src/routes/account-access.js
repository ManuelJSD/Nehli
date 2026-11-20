const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { Op } = require('sequelize');
const { sequelize } = require('../config/mysql');
const { cuentasModel } = require('../models');
const session = require('../middleware/session');
const admin = require('../middleware/rol')(['admin']);
const links = require('../utils/accountLinks');

const router = express.Router();
const email = () => body('email').isString().bail().trim().isEmail().isLength({ max: 254 });
const validate = (req, res, next) => validationResult(req).isEmpty()
    ? next() : res.status(400).json({ error: 'Comprueba los datos del formulario.' });
const limiter = rateLimit({
    windowMs: 15 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Demasiados intentos. Vuelve a intentarlo más tarde.' }
});

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.post('/invites', session, admin, email(), validate, async (req, res, next) => {
    try {
        const address = req.body.email.toLowerCase();
        const result = await links.issue('invite', { email: address }, 7 * 24 * 60 * 60_000);
        res.status(201).json(result);
    } catch (error) { next(error); }
});

router.get('/invites', session, admin, async (req, res, next) => {
    try {
        const invites = await links.Link.findAll({
            where: { kind: 'invite', expiresAt: { [Op.gt]: new Date() } },
            attributes: [['digest', 'id'], 'email', 'expiresAt'], order: [['createdAt', 'DESC']]
        });
        res.json(invites);
    } catch (error) { next(error); }
});

router.delete('/invites/:id', session, admin, async (req, res, next) => {
    try {
        await links.Link.destroy({ where: { kind: 'invite', digest: req.params.id } });
        res.sendStatus(204);
    } catch (error) { next(error); }
});

function recoveryUrl() {
    const configured = process.env.PUBLIC_APP_URL ||
        (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4200/');
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('PUBLIC_APP_URL no válida');
    url.pathname = url.pathname.replace(/\/?$/, '/');
    return new URL('restablecer', url);
}

async function sendRecovery(address, url) {
    const account = await cuentasModel.findOne({ where: { email: address }, attributes: ['id', 'email'] });
    if (!account) return;
    const recent = await links.Link.findOne({
        where: { kind: 'reset', accountId: account.id, createdAt: { [Op.gt]: new Date(Date.now() - 60_000) } }
    });
    if (recent) return;
    const { token } = await links.issue('reset', { accountId: account.id }, 30 * 60_000);
    url.hash = token;
    const port = Number(process.env.SMTP_PORT) || 465;
    const mail = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 10000, socketTimeout: 15000
    });
    await mail.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER, to: account.email,
        subject: 'Nehli — Restablecer contraseña',
        text: 'Abre este enlace para elegir otra contraseña. Caduca en 30 minutos.\n\n' + url.href
    });
}

router.post('/request-reset', limiter, email(), validate, (req, res) => {
    let url;
    try { url = recoveryUrl(); } catch {
        return res.status(503).json({ error: 'La recuperación de contraseña aún no está configurada.' });
    }
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(503).json({ error: 'La recuperación de contraseña aún no está configurada.' });
    }
    res.status(202).json({});
    void sendRecovery(req.body.email, url).catch(error => console.error('Error enviando recuperación:', error.code || error.name));
});

router.post('/reset', limiter, body('password').isString().bail().isLength({ min: 4, max: 24 }),
    body('passwordConfirmation').custom((value, { req }) => value === req.body.password), validate,
    async (req, res, next) => {
        try {
            const { token, password } = req.body;
            const link = await links.find('reset', token);
            const updated = link && await sequelize.transaction(async transaction => {
                const account = await cuentasModel.findByPk(link.accountId, { transaction, lock: transaction.LOCK.UPDATE });
                const active = account && await links.find('reset', token, transaction);
                if (!active) return false;
                await account.update({ password: await bcrypt.hash(password, 10) }, { transaction });
                await links.Link.destroy({ where: { kind: 'reset', accountId: account.id }, transaction });
                return true;
            });
            if (!updated) return res.status(400).json({ error: 'El enlace no es válido o ha caducado.' });
            res.sendStatus(204);
        } catch (error) { next(error); }
    });

module.exports = router;
