const { check } = require('express-validator');
const validationResult = require("../utils/handleValidator");

const validatorRegister = [
    check("username")
    .exists()
    .notEmpty()
    .isLength({min:4, max:24}),

    check("password")
    .exists()
    .notEmpty()
    .isLength({min:4, max:24}),

    check("email")
    .exists()
    .notEmpty()
    .isEmail(),

    (req, res, next) => {
        validationResult(req, res, next);
    }


];

const validatorLogin = [
    check("password")
    .exists()
    .notEmpty()
    .isLength({min:3, max:15}),

    check("username")
    .exists()
    .notEmpty()
    .isLength({min:4, max:24}),

    (req, res, next) => {
        validationResult(req, res, next);
    }


];

const validatorVerificacion = [
    check("codigo")
    .exists()
    .notEmpty(),

    check("username")
    .exists()
    .notEmpty()
    .isLength({min:4, max:24}),

    (req, res, next) => {
        validationResult(req, res, next);
    }


];

module.exports = { validatorRegister, validatorLogin, validatorVerificacion };