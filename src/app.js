require('dotenv').config();
require('./shared/infrastructure/firebase/firebaseAdmin'); // inicializa Firebase Admin antes que nada

const express = require('express');
const { createCorsMiddleware } = require('./modules/api/infrastructure/middlewares/corsConfig');
const { notFoundHandler, errorHandler } = require('./modules/api/infrastructure/middlewares/errorHandler');

const navegacionRoutes = require('./modules/api/infrastructure/routes/navegacion.routes');
const edificiosRoutes = require('./modules/api/infrastructure/routes/edificios.routes');
const locacionesRoutes = require('./modules/api/infrastructure/routes/locaciones.routes');
const navigationRepository = require('./modules/sistema_navegacion/infrastructure/repositories/FirestoreNavigationRepository');
const NavegacionController = require('./modules/api/infrastructure/controllers/NavegacionController');

const app = express();

app.use(createCorsMiddleware());
app.use(express.json());

// ── Healthcheck ─────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Rutas de la Arquitectura Hexagonal ───────────────────────
app.use('/navegacion', navegacionRoutes);
app.use('/edificios', edificiosRoutes);
app.use('/locaciones', locacionesRoutes);

// ── Rutas de Compatibilidad Directa con el Frontend Angular ──
// /ruta/:destino
app.get('/ruta/:destino', NavegacionController.obtenerRutaHaciaDestino);

// /navigation-paths
app.get('/navigation-paths', async (req, res) => {
  try {
    const paths = await navigationRepository.obtenerTodosLosPaths();
    res.json(paths);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/navigation-paths/piso/:piso', async (req, res) => {
  try {
    const path = await navigationRepository.obtenerPathPorPiso(req.params.piso);
    if (!path) return res.status(404).json({ error: 'No hay navigation-path para ese piso' });
    res.json(path);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /rutas (antigua colección)
app.get('/rutas', async (req, res) => {
  try {
    const rutas = await navigationRepository.obtenerRutasAntiguas();
    res.json(rutas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 404 y manejo global de errores ───────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
