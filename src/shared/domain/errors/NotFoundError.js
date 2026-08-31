const { DomainError } = require('./DomainError');

class NotFoundError extends (DomainError || Error) {
  constructor(message = 'Recurso no encontrado') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

module.exports = NotFoundError;
