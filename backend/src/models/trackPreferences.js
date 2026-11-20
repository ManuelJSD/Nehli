const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');
const Cuenta = require('./cuentas');

module.exports = sequelize.define('track_preferences', {
    account_id: {
        type: DataTypes.INTEGER, primaryKey: true,
        references: { model: Cuenta, key: 'id' }, onDelete: 'CASCADE'
    },
    series_key: { type: DataTypes.STRING(64), primaryKey: true },
    kind: { type: DataTypes.ENUM('audio', 'subtitle'), primaryKey: true },
    preference: { type: DataTypes.JSON, allowNull: false }
}, {
    tableName: 'track_preferences',
    timestamps: false
});
