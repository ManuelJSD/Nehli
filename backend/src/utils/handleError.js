/**
 * Envía una respuesta de error HTTP con el código y mensaje indicados.
 * @param {import('express').Response} res - Objeto de respuesta de Express
 * @param {string} [message="Algo sucedió"] - Mensaje de error legible
 * @param {number} [code=403] - Código de estado HTTP
 */
const handleHttpError = (res, message = "Algo sucedió", code = 403) => {
    res.status(code).json({ error: message });
};

module.exports = { handleHttpError };