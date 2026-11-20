const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');

module.exports = sequelize.define('account_link', {
    digest: { type: DataTypes.STRING(64), primaryKey: true },
    kind: { type: DataTypes.ENUM('invite', 'reset'), allowNull: false },
    email: DataTypes.STRING,
    accountId: DataTypes.INTEGER,
    expiresAt: { type: DataTypes.DATE, allowNull: false }
}, { indexes: [{ fields: ['kind', 'expiresAt'] }, { fields: ['kind', 'accountId'] }] });
