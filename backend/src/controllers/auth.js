const { matchedData } = require('express-validator');
const { tokenSign } = require('../utils/handleJwt');
const { handleHttpError } = require('../utils/handleError');
const { cuentasModel } = require('../models');
const { sequelize } = require('../config/mysql');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const accountLinks = require('../utils/accountLinks');
const { Policy, policyFor } = require('../utils/accessPolicy');

/**
 * Registra un nuevo usuario en el sistema.
 * Verifica que el username y email no estén en uso, hashea la contraseña
 * con bcrypt y envía un email de bienvenida.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const registerCtrl = async (req, res) => {
    try {
        const invitationToken = req.body.invitation;
        req = matchedData(req);
        const invitation = await accountLinks.find('invite', invitationToken);
        if (!invitation || invitation.email !== req.email.trim().toLowerCase()) {
            return handleHttpError(res, 'La invitación no es válida para este correo o ha caducado.', 400);
        }

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
        const body = { username: req.username, email: req.email, password: hashedPassword };
        const dataUser = await sequelize.transaction(async transaction => {
            const active = await accountLinks.find('invite', invitationToken, transaction);
            if (!active) return null;
            const account = await cuentasModel.create(body, { transaction });
            const settings = await Policy.findByPk(0, { transaction });
            if (settings?.approvalRequired) {
                await Policy.create({ accountId: account.id, pending: true }, { transaction });
                account.pendingApproval = true;
            }
            await active.destroy({ transaction });
            return account;
        });
        if (!dataUser) return handleHttpError(res, 'La invitación ya se ha utilizado o ha caducado.', 400);

        const data = {
            pendingApproval: !!dataUser.pendingApproval,
            ...(dataUser.pendingApproval ? {} : { token: await tokenSign(dataUser) })
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

        if ((await policyFor(user)).pending) {
            return handleHttpError(res, 'Tu cuenta está pendiente de aprobación.', 403);
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
            order: [['createdAt', 'DESC'], ['id', 'DESC']]
        });
        res.set('Cache-Control', 'no-store').status(200).json({ data });

    } catch (error) {
        console.error('Error al listar las cuentas:', error);
        handleHttpError(res, 'Error al listar las cuentas.', 500);
    }
};

const getProfileCtrl = (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const { username, email } = req.user;
    res.set('Cache-Control', 'no-store').json({ username, email });
};

const updateProfileCtrl = async (req, res, next) => {
    if (!req.user) return res.sendStatus(401);
    const { username, email, currentPassword, newPassword } = matchedData(req);
    const { id, password, role } = req.user;
    try {
        if (!await bcrypt.compare(currentPassword, password)) {
            return handleHttpError(res, 'La contraseña actual es incorrecta.', 401);
        }

        const changes = { username, email };
        if (newPassword) changes.password = await bcrypt.hash(newPassword, 10);
        const token = await tokenSign({ id, username, role });
        if (newPassword || username !== req.user.username || email !== req.user.email) {
            const [updated] = await cuentasModel.update(changes, { where: { id, password } });
            if (!updated) return handleHttpError(res, 'La cuenta cambió. Vuelve a abrir el formulario.', 409);
        }
        res.set('Cache-Control', 'no-store').json({ username, email, token });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return handleHttpError(res, 'El nombre de usuario o el correo ya están en uso.', 409);
        }
        next(error);
    }
};

const updateAccountRoleCtrl = async (req, res, next) => {
    const id = Number(req.params.id);
    const { role } = req.body || {};
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id <= 0 || !['user', 'admin'].includes(role)) {
        return handleHttpError(res, 'Cuenta o rol no válido.', 400);
    }
    if (id === req.user.id) return handleHttpError(res, 'No puedes cambiar tu propio rol.', 409);

    try {
        const result = await sequelize.transaction(async transaction => {
            // Serializa los cambios de rol y vuelve a verificar al administrador que los solicita.
            const admins = await cuentasModel.findAll({
                where: { role: 'admin' }, attributes: ['id'],
                order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE
            });
            if (!admins.some(admin => admin.id === req.user.id)) return 403;
            const target = await cuentasModel.findByPk(id, {
                attributes: ['id', 'role'], transaction, lock: transaction.LOCK.UPDATE
            });
            if (!target) return 404;
            if (role === 'admin' && (await Policy.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE }))?.pending) {
                return 409;
            }
            await target.update({ role }, { fields: ['role'], transaction });
            return 204;
        });
        if (result === 403) return handleHttpError(res, 'No tienes permisos.', 403);
        if (result === 404) return handleHttpError(res, 'La cuenta no existe.', 404);
        if (result === 409) return handleHttpError(res, 'Aprueba la cuenta antes de darle el rol de administrador.', 409);
        res.sendStatus(204);
    } catch (error) {
        next(error);
    }
};

module.exports = { registerCtrl, loginCtrl, listarCuentas, cambiarPassCtrl, getProfileCtrl, updateProfileCtrl, updateAccountRoleCtrl };