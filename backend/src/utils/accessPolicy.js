const Policy = require('../models/accountPolicy');
const MusicAccess = require('../models/musicAccess');

function deniedCategories(row) {
    const value = row?.deniedCategories;
    return typeof value === 'string' ? JSON.parse(value) : value ?? [];
}

async function policyFor(account) {
    if (account.role === 'admin') return { pending: false, deniedCategories: [] };
    const row = await Policy.findByPk(account.id);
    return { pending: row?.pending ?? false, deniedCategories: deniedCategories(row) };
}

function canAccessCategory(req, category) {
    if (typeof category !== 'string') return true;
    const key = category.normalize('NFC').toLowerCase();
    return !req.access.deniedCategories.some(value => value.normalize('NFC').toLowerCase() === key);
}

function requireCategory(req, res, next) {
    if (!canAccessCategory(req, req.query.category)) {
        return res.status(403).json({ error: 'Tu cuenta no tiene acceso a esta categoría.' });
    }
    next();
}

async function canAccessMusic(account) {
    if (account.role === 'admin') return true;
    const access = await MusicAccess.findByPk(account.id);
    return access?.allowed !== false;
}

async function requireMusic(req, res, next) {
    try {
        if (!await canAccessMusic(req.user)) {
            return res.status(403).json({ error: 'Tu cuenta no tiene acceso a Música.' });
        }
        next();
    } catch (error) { next(error); }
}

const mediaCookie = 'nehli_media_session';
const mediaCookieOptions = { httpOnly: true, sameSite: 'lax', path: '/api' };
function cookieToken(req) {
    return req.headers.cookie?.split(';').map(value => value.trim())
        .find(value => value.startsWith(mediaCookie + '='))?.slice(mediaCookie.length + 1);
}

function setMediaCookie(req, res) {
    const secure = req.secure || /^https:\/\//i.test(req.get('Origin') || '');
    res.cookie(mediaCookie, req.sessionToken, { ...mediaCookieOptions, secure });
}

module.exports = { Policy, canAccessMusic, requireMusic, policyFor, deniedCategories, canAccessCategory, requireCategory, mediaCookie, mediaCookieOptions, cookieToken, setMediaCookie };
