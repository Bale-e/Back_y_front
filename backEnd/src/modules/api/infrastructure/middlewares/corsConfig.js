const cors = require('cors');

/**
 * Antes, si CORS_ORIGIN no estaba definido se aceptaba CUALQUIER origen
 * (origin: true). Ahora, sin CORS_ORIGIN no se acepta ningún origen externo
 * (solo el propio servidor cuando sirve el frontend compilado).
 */
function createCorsMiddleware() {
  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    console.warn('[cors] CORS_ORIGIN vacío: no se aceptan orígenes externos.');
  }

  return cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
}

module.exports = { createCorsMiddleware };
