const { Sequelize } = require('sequelize');

const database = process.env.MYSQL_DATABASE;
const username = process.env.MYSQL_USER;
const password = process.env.MYSQL_PASSWORD;
const host = process.env.MYSQL_HOST;

const sequelize = new Sequelize(database, username, password, {
  host,
  dialect: 'mysql',
  logging: process.env.NODE_ENV !== 'production' ? console.log : false,
});

/**
 * Establece la conexión con la base de datos MySQL y sincroniza los modelos.
 * 
 * IMPORTANTE sobre `sequelize.sync()`:
 * - En desarrollo (`NODE_ENV !== 'production'`): `alter: true` — ajusta
 *   las columnas existentes sin perder datos, pero puede modificar la estructura.
 * - En producción: `alter: false` — NO modifica las tablas. Usar migraciones
 *   de Sequelize para cambios de esquema en producción.
 */
const dbConnectMySql = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL: Conexión correcta.');

    const isProduction = process.env.NODE_ENV === 'production';
    await sequelize.sync({ alter: !isProduction });
    console.log(`Tablas sincronizadas (alter: ${!isProduction}).`);

  } catch (error) {
    console.error('MySQL: Error de conexión', error);
  }
};

module.exports = { sequelize, dbConnectMySql };