const { matchedData } = require("express-validator");
const { tokenSign } = require("../utils/handleJwt");
const { handleHttpError } = require("../utils/handleError");
const { cuentasModel } = require("../models");
const nodemailer = require('nodemailer');
const bcrypt = require("bcryptjs");

/**
 * Este controlador es el encargado de registrar un usuario
 * @param {*} req 
 * @param {*} res 
 */
const registerCtrl = async (req, res) => {

    try {
        req = matchedData(req);
        const user = await cuentasModel.findOne({
            where: {
                username: req.username
            }
        });

        const email = await cuentasModel.findOne({
            where: {
                email: req.email
            }
        });

        if (user) {
            handleHttpError(res, "El nombre de usuario ya existe, por favor elija otro.", 404);
            return
        }

        if (email) {
            handleHttpError(res, "Ya hay una cuenta registrada con ese email.", 404);
            return
        }

        // Generar el hash de la contraseña
        const hashedPassword = await bcrypt.hash(req.password, 10);
        const body = { ...req, password: hashedPassword };
        const dataUser = await cuentasModel.create(body)

        const data = {
            token: await tokenSign(dataUser),
        }

        // Definimos el transporter
        var transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port: parseInt(process.env.SMTP_PORT) || 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Definimos el email
        var mailOptions = {
            from: process.env.SMTP_FROM || 'no-reply@Nehli.com',
            to: req.email,
            subject: 'Nehli - Verifica tú cuenta',
            text: 'Hola ' + req.username + ' te damos la bienvenida a Nehli.'
        };

        // Enviamos el email
        transporter.sendMail(mailOptions, function (error, info) { });

        res.status(201);
        res.send({ data });

    } catch (error) {
        handleHttpError(res, "Error al registrar la cuenta.");
        console.log("Error al registrar la cuenta.", error);

    }
}

/**
 * Este controlador es el encargado de logear un usuario
 * @param {*} req 
 * @param {*} res 
 */
const loginCtrl = async (req, res) => {
    try {
        req = matchedData(req);
        const user = await cuentasModel.findOne({
            where: {
                username: req.username
            }
        });

        if (!user) {
            handleHttpError(res, "El usuario o la contraseña son incorrectos.", 404);
            return
        }

        const hashPassword = user.get('password');
        const check = await bcrypt.compare(req.password, hashPassword);

        if (!check) {
            handleHttpError(res, "El usuario o la contraseña son incorrectos.", 401);
            return
        }

        const data = {
            token: await tokenSign(user),
        }

        res.status(201);
        res.send({ data })

    } catch (error) {
        handleHttpError(res, "Error al iniciar sesión.");
        console.log("Error al iniciar sesión.", error);
    }
}

/**
 * Este controlador es el encargado de cambiar la pass de una cuenta
 * @param {*} req 
 * @param {*} res 
 */
cambiarPassCtrl = async (req, res) => {

    try {
        const id = req.user.id;

        const user = await cuentasModel.findByPk(id);

        const hashPassword = user.get('password');
        const salt = user.get('salt');

        const check = await comparar(req.body.password, salt, hashPassword);

        if (!check) {
            handleHttpError(res, "El usuario o la contraseña son incorrectos.", 401);
            return
        }

        const newsalt = await generateRandomString(32);
        const password = await encrypt(req.body.password, newsalt);

        const result = await cuentasModel.update(
            {
                password: password,
                salt: newsalt
            },
            { where: { id: id } }
        );

        res.status(201);
        res.send(result)


    } catch (error) {
        handleHttpError(res, 'Error al cambiar contraseñas.');
    }

}

/**
 * Este controlador es el encargado de verificar una cuenta
 * @param {*} req 
 * @param {*} res 
 */
const verificarCuenta = async (req, res) => {
    try {
        req = matchedData(req);
        const user = await cuentasModel.findOne({
            where: {
                username: req.username,
                codigo: req.codigo
            }
        });

        if (!user) {
            handleHttpError(res, "El usuario o el codigo de verificación es incorrecto.", 404);
            return
        }

        if (!codigo) {
            handleHttpError(res, "El usuario o el codigo de verificación es incorrecto.", 401);
            return
        }

        const result = await cuentasModel.update(
            {
                status: 1,
                id_confirmacion: null
            },
            { where: { id: id } }
        );

        res.status(201);
        res.send({ result })

    } catch (error) {
        handleHttpError(res, "Error al verificar la cuenta.")
    }
}

/**
 * Lista de noticias
 * @param {*} req 
 * @param {*} res 
 */
const listarCuentas = async (req, res) => {
    try {
        const user = req.user;
        const data = await cuentasModel.find({});
        res.send({ data, user });

    } catch (error) {
        handleHttpError(res, 'Error al listar las cuentas.');
    }
}

module.exports = { registerCtrl, loginCtrl, listarCuentas, cambiarPassCtrl }