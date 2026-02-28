const express = require('express');
const rateLimit = require('express-rate-limit');
const { loginCtrl, registerCtrl, listarCuentas, cambiarPassCtrl } = require('../controllers/auth');
const router = express.Router();
const { validatorRegister, validatorLogin, validatorCambiarPass } = require('../validators/auth');
const authMiddleware = require('../middleware/session');
const checkRol = require('../middleware/rol');

// ─── Rate Limiter específico para autenticación ──────────────────────────────
// Máximo 10 intentos de login/register por IP en 15 minutos.
// Mucho más restrictivo que el límite global para proteger contra fuerza bruta.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Inténtalo de nuevo en 15 minutos.' },
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - auth
 *     summary: Registra un nuevo usuario
 *     description: Crea una nueva cuenta. Limitado a 10 intentos por IP cada 15 minutos.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/authRegister"
 *     responses:
 *       '201':
 *         description: Usuario registrado correctamente
 *       '409':
 *         description: El usuario o email ya existen
 *       '429':
 *         description: Demasiados intentos
 */
router.post('/register', authLimiter, validatorRegister, registerCtrl);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - auth
 *     summary: Inicia sesión y obtiene un token JWT
 *     description: Devuelve un token válido por 12h. Limitado a 10 intentos por IP cada 15 minutos.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/authLogin"
 *     responses:
 *       '200':
 *         description: Login correcto, devuelve token JWT
 *       '401':
 *         description: Credenciales incorrectas
 *       '429':
 *         description: Demasiados intentos
 */
router.post('/login', authLimiter, validatorLogin, loginCtrl);

/**
 * @swagger
 * /auth/cambiarpass:
 *   post:
 *     summary: Cambia la contraseña del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [old_password, new_password]
 *             properties:
 *               old_password:
 *                 type: string
 *                 description: Contraseña actual
 *               new_password:
 *                 type: string
 *                 description: Nueva contraseña
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
 *       401:
 *         description: Contraseña actual incorrecta
 *       500:
 *         description: Error interno del servidor
 */
router.post('/cambiarpass', authMiddleware, validatorCambiarPass, cambiarPassCtrl);

/**
 * @swagger
 * /auth/listar:
 *   get:
 *     summary: Lista cuentas (solo admins)
 *     security:
 *       - bearerAuth: []
 *     description: Devuelve id, username, role y createdAt — sin datos sensibles.
 *     responses:
 *       200:
 *         description: Lista de cuentas
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/listar', authMiddleware, checkRol(['admin']), listarCuentas);

module.exports = router;