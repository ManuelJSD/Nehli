const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');
const Account = require('./cuentas');

module.exports = sequelize.define('music_access', {
    accountId: {
        type: DataTypes.INTEGER, primaryKey: true,
        references: { model: Account, key: 'id' }, onDelete: 'CASCADE'
    },
    allowed: { type: DataTypes.BOOLEAN, allowNull: false }
}, { tableName: 'music_access', timestamps: false });
