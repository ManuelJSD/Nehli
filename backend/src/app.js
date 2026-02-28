require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUI = require('swagger-ui-express');
const openApiConfigration = require('./docs/swagger');
const { dbConnectMySql } = require('./config/mysql');

const app = express();

// ─── Seguridad: Headers HTTP ─────────────────────────────────────────────────
app.use(helmet());

// ─── Seguridad: CORS con whitelist ───────────────────────────────────────────
// Solo se aceptan peticiones desde los orígenes configurados en CORS_ORIGIN.
// En desarrollo: http://localhost:4200
// En producción: ajustar a la URL del frontend desplegado
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:4200'];

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requests sin origin (ej: Swagger UI local, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origen no permitido — ${origin}`));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

// ─── Parseo de JSON ───────────────────────────────────────────────────────────
app.use(express.json());

// ─── Seguridad: Rate Limiting global (anti-flood) ────────────────────────────
// Límite general para toda la API: 200 peticiones por IP / 15 minutos
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' },
});

app.use('/api', globalLimiter);

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use('/api', require('./routes'));

// ─── Documentación Swagger ────────────────────────────────────────────────────
app.use('/documentation', swaggerUI.serve, swaggerUI.setup(openApiConfigration));

// ─── Servidor ─────────────────────────────────────────────────────────────────
const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';

app.listen(port, function (err) {
  if (err) return console.error(err);
  console.log(`Servidor escuchando en http://${host}:${port}`);
});

// ─── Base de datos ────────────────────────────────────────────────────────────
dbConnectMySql();