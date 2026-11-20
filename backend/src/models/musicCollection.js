const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');
const Account = require('./cuentas');

module.exports = sequelize.define('music_collection', {
    accountId: {
        type: DataTypes.INTEGER, primaryKey: true,
        references: { model: Account, key: 'id' }, onDelete: 'CASCADE'
    },
    id: { type: DataTypes.STRING(64), primaryKey: true },
    kind: { type: DataTypes.ENUM('favorite', 'playlist'), allowNull: false },
    name: DataTypes.STRING(100),
    tracks: DataTypes.JSON
}, { tableName: 'music_collections', timestamps: false });
