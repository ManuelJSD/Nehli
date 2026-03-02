require('dotenv').config(); // Init 
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUI = require('swagger-ui-express');
const openApiConfigration = require('./docs/swagger');
const { dbConnectMySql } = require('./config/mysql');

const app = express();

// ─── Seguridad: CORS con whitelist ───────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:4200'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (process.env.CORS_ORIGIN === '*') {
      return callback(null, true); // Permite cualquier origen (reflect origin)
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error(`CORS: Origen no permitido — ${origin}`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// ─── Seguridad: Headers HTTP ─────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

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