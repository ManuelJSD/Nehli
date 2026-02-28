const { sequelize } = require("../config/mysql")
const { DataTypes } = require("sequelize");

const Cuenta = sequelize.define(
  "cuentas",
  {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    confirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },  
    role: {
      type: DataTypes.ENUM(["user", "admin"]),
      defaultValue: "user",
    },
  },
  {
    timestamps: true,
  }
);

Cuenta.find = Cuenta.findAll;
Cuenta.findById = Cuenta.findByPk;
module.exports = Cuenta;