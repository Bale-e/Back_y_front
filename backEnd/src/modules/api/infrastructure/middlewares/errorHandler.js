const { DomainError } = require('../../../../shared/domain/errors/DomainError');

function notFoundHandler(req, res, next) {
  res.status(404).json({ error: 'Ruta no encontrada.' });
}

// Errores de dominio (validación, no encontrado): su mensaje es para el
// usuario. Cualquier otro error (Firestore, bug): el detalle queda en el log
// del servidor y al cliente solo le llega un mensaje genérico — antes se
// devolvía err.message, que podía revelar detalles internos de Firestore.
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud es demasiado grande.' });
  }

  const esDominio = err instanceof DomainError || Boolean(err.statusCode);
  const status = esDominio ? (err.statusCode || 400) : 500;

  if (status >= 500) {
    console.error(`[Error 500] ${req.method} ${req.originalUrl}:`, err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }

  res.status(status).json({ error: err.message || 'Solicitud inválida.' });
}

module.exports = { notFoundHandler, errorHandler };
