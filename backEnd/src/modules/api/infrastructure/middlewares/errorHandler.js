const { DomainError } = require('../../../../shared/domain/errors/DomainError');

function notFoundHandler(req, res, next) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  const isDomainError = err instanceof DomainError || err.statusCode;
  const status = isDomainError ? (err.statusCode || 400) : (err.status || 500);

  if (status >= 500) {
    console.error(`[Error 500] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(status).json({
    error: err.message || 'Error interno del servidor',
  });
}

module.exports = { notFoundHandler, errorHandler };
