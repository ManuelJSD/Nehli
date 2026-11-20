const { handleHttpError } = require('../utils/handleError');

const checkRol = roles => (req, res, next) => {
    if (!req.user) return handleHttpError(res, 'Necesitas iniciar sesión.', 401);
    if (!roles.includes(req.user.role)) return handleHttpError(res, 'No tienes permisos.', 403);
    next();
};

module.exports = checkRol;
