const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET

/**
 *  Debes pasar el objeto del usuario
 * @param {*} user 
 */
const tokenSign = async (user) => {
    const sign = jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email,
            vip: user.vip,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            role: user.role,
        },
        JWT_SECRET,
        {
            expiresIn: '12h'
        }
    );

    return sign;
}

/**
 * Debes pasar el token de sesion
 * @param {*} tokenJwt 
 * @returns 
 */
const verifyToken = async (tokenJwt) => {
    try {
        return jwt.verify(tokenJwt, JWT_SECRET);

    } catch (error) {
        return null;

    }
}

module.exports = { tokenSign, verifyToken }