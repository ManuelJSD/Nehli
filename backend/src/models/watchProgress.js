const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');
const Cuenta = require('./cuentas');

module.exports = sequelize.define('watch_progress', {
    account_id: {
        type: DataTypes.INTEGER, primaryKey: true,
        references: { model: Cuenta, key: 'id' }, onDelete: 'CASCADE'
    },
    episode_key: { type: DataTypes.STRING(64), primaryKey: true },
    episode_path: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.DOUBLE, allowNull: false },
    duration: { type: DataTypes.DOUBLE, allowNull: false },
    completed: { type: DataTypes.BOOLEAN, allowNull: false },
    observed_at: { type: DataTypes.BIGINT, allowNull: false }
}, {
    tableName: 'watch_progress',
    timestamps: false,
    indexes: [{ fields: ['account_id', 'completed', 'observed_at'] }]
});
