const edificioRepository = require('../../infrastructure/repositories/FirestoreEdificioRepository');

class ObtenerEdificioPorIdUseCase {
  constructor(repo = edificioRepository) {
    this.repo = repo;
  }

  async execute(id) {
    return this.repo.obtenerPorId(id);
  }
}

module.exports = new ObtenerEdificioPorIdUseCase();
