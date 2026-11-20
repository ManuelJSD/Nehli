const { handleHttpError } = require('../utils/handleError');
const { verifyToken } = require('../utils/handleJwt');
const { cuentasModel } = require('../models');
const { cookieToken, policyFor } = require('../utils/accessPolicy');

function authenticate(allowMediaCookie = false) {
    return async (req, res, next) => {
        try {
            const authorization = req.headers.authorization;
            const token = authorization ? authorization.split(' ').pop() : allowMediaCookie && cookieToken(req);
            const payload = token && await verifyToken(token);
            const account = payload && await cuentasModel.findOne({ where: { id: payload.id } });
            if (!account) return handleHttpError(res, 'Necesitas iniciar sesión.', 401);
            const access = await policyFor(account);
            if (access.pending) return handleHttpError(res, 'Tu cuenta está pendiente de aprobación.', 403);
            req.user = account;
            req.access = access;
            req.sessionToken = token;
            next();
        } catch (error) {
            next(error);
        }
    };
}

module.exports = authenticate();
module.exports.mediaSession = authenticate(true);
