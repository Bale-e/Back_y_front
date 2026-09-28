const { DomainError } = require('./DomainError');

class ValidationError extends (DomainError || Error) {
  constructor(message = 'Error de validación') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

module.exports = ValidationError;
