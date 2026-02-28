const { check } = require('express-validator');
const validationResult = require('../utils/handleValidator');

/**
 * Validador para el registro de nuevos usuarios.
 * Aplica las mismas reglas de longitud de contraseña que el login
 * para evitar inconsistencias (min: 4, max: 24).
 */
const validatorRegister = [
    check('username')
        .exists()
        .notEmpty()
        .isLength({ min: 4, max: 24 })
        .withMessage('El nombre de usuario debe tener entre 4 y 24 caracteres.'),

    check('password')
        .exists()
        .notEmpty()
        .isLength({ min: 4, max: 24 })
        .withMessage('La contraseña debe tener entre 4 y 24 caracteres.'),

    check('email')
        .exists()
        .notEmpty()
        .isEmail()
        .withMessage('Debe ser un email válido.'),

    (req, res, next) => {
        validationResult(req, res, next);
    }
];

/**
 * Validador para el inicio de sesión.
 * Reglas de contraseña unificadas con el registro (min: 4, max: 24).
 */
const validatorLogin = [
    check('username')
        .exists()
        .notEmpty()
        .isLength({ min: 4, max: 24 })
        .withMessage('El nombre de usuario debe tener entre 4 y 24 caracteres.'),

    check('password')
        .exists()
        .notEmpty()
        .isLength({ min: 4, max: 24 })
        .withMessage('La contraseña debe tener entre 4 y 24 caracteres.'),

    (req, res, next) => {
        validationResult(req, res, next);
    }
];

/**
 * Validador para cambio de contraseña.
 * Verifica que se envíen la contraseña actual y la nueva.
 */
const validatorCambiarPass = [
    check('old_password')
        .exists()
        .notEmpty()
        .isLength({ min: 4, max: 24 })
        .withMessage('La contraseña actual debe tener entre 4 y 24 caracteres.'),

    check('new_password')
        .exists()
        .notEmpty()
        .isLength({ min: 4, max: 24 })
        .withMessage('La nueva contraseña debe tener entre 4 y 24 caracteres.'),

    (req, res, next) => {
        validationResult(req, res, next);
    }
];

module.exports = { validatorRegister, validatorLogin, validatorCambiarPass };