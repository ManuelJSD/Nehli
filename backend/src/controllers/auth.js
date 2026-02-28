const { matchedData } = require('express-validator');
const { tokenSign } = require('../utils/handleJwt');
const { handleHttpError } = require('../utils/handleError');
const { cuentasModel } = require('../models');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

/**
 * Registra un nuevo usuario en el sistema.
 * Verifica que el username y email no estén en uso, hashea la contraseña
 * con bcrypt y envía un email de bienvenida.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const registerCtrl = async (req, res) => {
    try {
        req = matchedData(req);

        // Verificar username y email en paralelo para reducir latencia
        const [userExistente, emailExistente] = await Promise.all([
            cuentasModel.findOne({ where: { username: req.username } }),
            cuentasModel.findOne({ where: { email: req.email } })
        ]);

        if (userExistente) {
            handleHttpError(res, 'El nombre de usuario ya existe, por favor elija otro.', 409);
            return;
        }

        if (emailExistente) {
            handleHttpError(res, 'Ya hay una cuenta registrada con ese email.', 409);
            return;
        }

        // Hashear la contraseña antes de guardar
        const hashedPassword = await bcrypt.hash(req.password, 10);
        const body = { ...req, password: hashedPassword };
        const dataUser = await cuentasModel.create(body);

        const data = {
            token: await tokenSign(dataUser),
        };

        // Enviar email de bienvenida (no bloquea la respuesta)
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const mailOptions = {
            from: process.env.SMTP_FROM || 'no-reply@nehli.com',
            to: req.email,
            subject: 'Nehli — Bienvenido',
            text: `Hola ${req.username}, bienvenido a Nehli.`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) console.error('Error al enviar email de bienvenida:', error);
        });

        res.status(201).json({ data });

    } catch (error) {
        console.error('Error al registrar la cuenta:', error);
        handleHttpError(res, 'Error al registrar la cuenta.', 500);
    }
};

/**
 * Inicia sesión de un usuario y devuelve un token JWT.
 * Usa un mensaje genérico para no revelar si el usuario existe.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const loginCtrl = async (req, res) => {
    try {
        req = matchedData(req);

        const user = await cuentasModel.findOne({
            where: { username: req.username }
        });

        // Mensaje genérico para no revelar si el usuario existe (prevents user enumeration)
        if (!user) {
            handleHttpError(res, 'El usuario o la contraseña son incorrectos.', 401);
            return;
        }

        const hashPassword = user.get('password');
        const check = await bcrypt.compare(req.password, hashPassword);

        if (!check) {
            handleHttpError(res, 'El usuario o la contraseña son incorrectos.', 401);
            return;
        }

        const data = {
            token: await tokenSign(user),
        };

        res.status(200).json({ data });

    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        handleHttpError(res, 'Error al iniciar sesión.', 500);
    }
};

/**
 * Permite a un usuario autenticado cambiar su contraseña.
 * Requiere la contraseña actual y la nueva contraseña.
 * Reescrito con bcrypt — elimina dependencias no definidas anteriores.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const cambiarPassCtrl = async (req, res) => {
    try {
        const id = req.user.id;

        const user = await cuentasModel.findByPk(id);

        if (!user) {
            handleHttpError(res, 'Usuario no encontrado.', 404);
            return;
        }

        const hashPassword = user.get('password');
        const check = await bcrypt.compare(req.body.old_password, hashPassword);

        if (!check) {
            handleHttpError(res, 'La contraseña actual es incorrecta.', 401);
            return;
        }

        const newHashedPassword = await bcrypt.hash(req.body.new_password, 10);

        await cuentasModel.update(
            { password: newHashedPassword },
            { where: { id } }
        );

        res.status(200).json({ message: 'Contraseña actualizada correctamente.' });

    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        handleHttpError(res, 'Error al cambiar la contraseña.', 500);
    }
};

/**
 * Lista las cuentas de usuario para administración.
 * Devuelve únicamente campos no sensibles — excluye password, email y salt.
 * Requiere autenticación (authMiddleware) y rol de admin.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const listarCuentas = async (req, res) => {
    try {
        const data = await cuentasModel.findAll({
            attributes: ['id', 'username', 'role', 'createdAt'],
        });
        res.status(200).json({ data });

    } catch (error) {
        console.error('Error al listar las cuentas:', error);
        handleHttpError(res, 'Error al listar las cuentas.', 500);
    }
};

module.exports = { registerCtrl, loginCtrl, listarCuentas, cambiarPassCtrl };