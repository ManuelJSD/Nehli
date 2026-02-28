require("dotenv").config()
const express = require('express');
const cors = require('cors');
const swaggerUI = require('swagger-ui-express');
const openApiConfigration = require('./docs/swagger');
const { dbConnectMySql } = require('./config/mysql')
const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';

app.use("/api", require("./routes"));

/**
 * Definir ruta de documentación
 */
app.use('/documentation', swaggerUI.serve, swaggerUI.setup(openApiConfigration));

/**
 * Invocamos a las rutas
 */

 app.listen(port, function(err) {
    if (err) return console.log(err);
    console.log("Escuchando el puerto %s", port);
  });

dbConnectMySql();