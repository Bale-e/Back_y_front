const rateLimit = require('express-rate-limit');

function demasiadas(req, res) {
  res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' });
}

// Lecturas del mapa: generoso (cada visita hace varias consultas), pero con
// tope para que nadie pueda martillar Firestore y gastar la cuota.
const lecturaLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_LECTURA) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: demasiadas,
});

// Escrituras / login de administrador: muy pocos intentos, para que la clave
// de administrador no se pueda adivinar por fuerza bruta.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_ADMIN) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: demasiadas,
});

module.exports = { lecturaLimiter, adminLimiter };
