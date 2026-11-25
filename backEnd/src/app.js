const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('./shared/infrastructure/firebase/firebaseAdmin'); // inicializa Firebase Admin antes que nada
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const { createCorsMiddleware } = require('./modules/api/infrastructure/middlewares/corsConfig');
const { notFoundHandler, errorHandler } = require('./modules/api/infrastructure/middlewares/errorHandler');
const { requireAdmin } = require('./modules/api/infrastructure/middlewares/adminAuth');
const { lecturaLimiter, adminLimiter } = require('./modules/api/infrastructure/middlewares/rateLimits');

const navegacionRoutes = require('./modules/api/infrastructure/routes/navegacion.routes');
const edificiosRoutes = require('./modules/api/infrastructure/routes/edificios.routes');
const locacionesRoutes = require('./modules/api/infrastructure/routes/locaciones.routes');
const adminRoutes = require('./modules/api/infrastructure/routes/admin.routes');
const NavegacionController = require('./modules/api/infrastructure/controllers/NavegacionController');

const app = express();

// Detrás de un proxy (LiteSpeed/cPanel, Nginx, Docker): necesario para que el
// límite de solicitudes vea la IP real de cada visitante. Solo activar si de
// verdad hay un proxy de confianza adelante.
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Cabeceras de seguridad. La CSP de helmet se desactiva aquí porque esta app
// también sirve el frontend Angular + BabylonJS (WebGL, workers, blobs): la
// CSP del frontend se define en frontend/nginx.conf.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(createCorsMiddleware());
// Compresión gzip de las respuestas. Importa sobre todo cuando este servidor
// entrega el frontend: main.js pesa ~7 MB sin comprimir (~1,2 MB con gzip) y
// los modelos .obj son texto que se reduce a ~1/4.
app.use(compression({
  // model/obj y model/mtl no figuran como "comprimibles" en la lista por defecto,
  // pero son texto: sin esto el .obj de la sede (3,4 MB) viajaba sin comprimir.
  filter: (req, res) => /^model\/(obj|mtl)/.test(String(res.getHeader('Content-Type') || '')) || compression.filter(req, res),
}));
app.use(express.json({ limit: '20kb' }));

// ── Healthcheck (Público) ───────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Raíz de api.inago.inacode.cl: respuesta simple en vez de 404. cPanel
// revisa "/" al instalar o reiniciar la app y, con un 404, avisa que el
// chequeo falló aunque la API funcione. Solo aplica cuando este servidor no
// entrega también el frontend compilado (en ese caso "/" es el mapa).
const hayFrontend = fs.existsSync(path.join(__dirname, '../../frontend/dist/inamap-angular/browser/index.html'))
  || fs.existsSync(path.join(__dirname, '../../frontend/dist/inamap-angular/index.html'));
if (!hayFrontend) {
  app.get('/', (req, res) => res.json({ servicio: 'API InaGo', status: 'ok' }));
}

// ── Rutas de la API ──────────────────────────────────────────
// Lecturas: públicas (el mapa del campus es información pública y el token
// que había antes igual viajaba dentro del frontend, a la vista de todos),
// con límite de solicitudes por IP. Escrituras: ver edificios.routes.js,
// exigen ADMIN_TOKEN.
app.use(['/navegacion', '/edificios', '/locaciones', '/ruta', '/navigation-paths', '/rutas'], lecturaLimiter);
app.use('/navegacion', navegacionRoutes);
app.use('/edificios', edificiosRoutes);
app.use('/locaciones', locacionesRoutes);
app.use('/admin', adminRoutes);

// ── Rutas de Compatibilidad Directa con el Frontend Angular ──
app.get('/ruta/:destino', NavegacionController.obtenerRutaHaciaDestino);
app.get('/navigation-paths', NavegacionController.listarNavigationPaths);
app.get('/navigation-paths/piso/:piso', NavegacionController.obtenerNavigationPathPorPiso);
app.get('/rutas', NavegacionController.listarRutasAntiguas);

// ── Monorepo: Servicio Estático del Frontend Angular Compilado ─
const frontendDistPath = path.join(__dirname, '../../frontend/dist/inamap-angular/browser');
const legacyDistPath = path.join(__dirname, '../../frontend/dist/inamap-angular');

const distPathToUse = fs.existsSync(frontendDistPath)
  ? frontendDistPath
  : fs.existsSync(legacyDistPath)
  ? legacyDistPath
  : null;

if (distPathToUse) {
  app.use(express.static(distPathToUse, {
    setHeaders(res, filePath) {
      // Bundles con hash en el nombre: caché larga. Modelos 3D e imágenes no
      // llevan hash: 1 día y revalidar (si se reemplaza un .obj, se ve al día siguiente).
      if (/-[A-Z0-9]{8}\.(js|css)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (/\.(glb|gltf|obj|mtl|fbx|png|jpe?g|svg|ico)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
      } else if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  app.use((req, res, next) => {
    // Si es una petición GET no API, devolver el index.html de la SPA
    if (
      req.method === 'GET' &&
      !req.path.startsWith('/edificios') &&
      !req.path.startsWith('/locaciones') &&
      !req.path.startsWith('/navegacion') &&
      !req.path.startsWith('/ruta') &&
      !req.path.startsWith('/navigation-paths') &&
      !req.path.startsWith('/rutas') &&
      !req.path.startsWith('/health') &&
      !req.path.startsWith('/admin')
    ) {
      return res.sendFile(path.join(distPathToUse, 'index.html'));
    }
    next();
  });
}

// ── 404 y manejo global de errores ───────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
