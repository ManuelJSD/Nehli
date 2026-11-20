const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');

module.exports = sequelize.define('account_policy', {
    accountId: { type: DataTypes.INTEGER, primaryKey: true },
    pending: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
    deniedCategories: DataTypes.JSON,
    approvalRequired: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false }
}, { timestamps: false });
