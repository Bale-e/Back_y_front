const ValidationError = require('../../../../shared/domain/errors/ValidationError');

function validateQuery(requiredParams = []) {
  return (req, res, next) => {
    const missing = requiredParams.filter((param) => !req.query[param]);
    if (missing.length > 0) {
      return next(new ValidationError(`Faltan parámetros requeridos en la consulta: ${missing.join(', ')}`));
    }
    next();
  };
}

module.exports = { validateQuery };
