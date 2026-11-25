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

// Login de administrador: muy pocos intentos para evitar fuerza bruta contra la clave
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_ADMIN_LOGIN) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: demasiadas,
});

// Operaciones autenticadas de administrador (CRUD, explorador Firestore):
// Cupo amplio para permitir navegación, edición de múltiples documentos y auditoría.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_ADMIN) || 1200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: demasiadas,
});

module.exports = { lecturaLimiter, adminLimiter, adminLoginLimiter };
