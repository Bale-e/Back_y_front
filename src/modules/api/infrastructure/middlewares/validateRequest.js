const ValidationError = require('../../../../shared/domain/errors/ValidationError');

function validateQuery(requiredParams = []) {
  return (req, res, next) => {
    const missing = requiredParams.filter((param) => !req.query[param]);
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Faltan parámetros requeridos en la consulta: ${missing.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = { validateQuery };
