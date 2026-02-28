const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Genera y firma un token JWT con los datos mínimos necesarios del usuario.
 * Solo incluye id, username y role — sin datos sensibles ni innecesarios.
 * @param {object} user - Objeto usuario (instancia Sequelize)
 * @returns {Promise<string>} Token JWT firmado
 */
const tokenSign = async (user) => {
    const sign = jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role,
        },
        JWT_SECRET,
        {
            expiresIn: '12h'
        }
    );

    return sign;
};

/**
 * Verifica y decodifica un token JWT.
 * @param {string} tokenJwt - Token JWT a verificar
 * @returns {Promise<object|null>} Payload decodificado, o null si es inválido/expirado
 */
const verifyToken = async (tokenJwt) => {
    try {
        return jwt.verify(tokenJwt, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

module.exports = { tokenSign, verifyToken };