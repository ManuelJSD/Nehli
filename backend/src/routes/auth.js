const express = require("express");
const { loginCtrl, registerCtrl, listarCuentas, cambiarPassCtrl } = require("../controllers/auth")
const router = express.Router();
const { validatorRegister, validatorLogin, validatorVerificacion } = require("../validators/auth");
const authMiddleware = require('../middleware/session');
const sendEmail = require('../controllers/mail');

/**
 * http://localhost:3001/api
 * 
 * Route register new user
 * @openapi
 * /auth/register:
 *      post:
 *          tags:
 *              - auth
 *          summary: "Register nuevo usario"
 *          description: "Esta ruta es para registrar un nuevo usuario"
 *          requestBody:
 *              content:
 *                  application/json:
 *                      schema:
 *                          $ref: "#/components/schemas/authRegister"
 *          responses:
 *                  '201':
 *                      description: El usuario se registra de manera correcta
 *                  '403':
 *                      description: Error por validacion
 */
router.post("/register", validatorRegister, registerCtrl);
/**
 * Login user
 * @openapi
 * /auth/login:
 *    post:
 *      tags:
 *        - auth
 *      summary: "Login user"
 *      description: Iniciar session a un nuevo usuario y obtener el token de sesión
 *      responses:
 *        '200':
 *          description: Retorna el objeto insertado en la coleccion.
 *        '422':
 *          description: Error de validacion.
 *      requestBody:
 *          content:
 *            application/json:
 *              schema:
 *                 $ref: "#/components/schemas/authLogin"
 *    responses:
 *      '201':
 *        description: Retorna el objeto insertado en la coleccion con stado '201'
 *      '403':
 *        description: No tiene permisos '403'
 */
router.post("/login", validatorLogin, loginCtrl);

/**
 * @swagger
 * /cambiarpass:
 *   post:
 *     summary: Cambia la contraseña del usuario actual
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               old_password:
 *                 type: string
 *                 description: Contraseña actual del usuario
 *               new_password:
 *                 type: string
 *                 description: Nueva contraseña del usuario
 *             example:
 *               old_password: "passwordAnterior123"
 *               new_password: "nuevaContraseña123"
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
 *       401:
 *         description: Acceso no autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.post("/cambiarpass", authMiddleware, cambiarPassCtrl);

/**
 * @swagger
 * /listar:
 *   get:
 *     summary: Obtiene una lista de cuentas de usuario
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de cuentas obtenida correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Cuenta'
 *       401:
 *         description: Acceso no autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get("/listar", authMiddleware, listarCuentas);

// router.post("/verificarcuenta", validatorVerificacion, verificarCuenta);

module.exports = router;