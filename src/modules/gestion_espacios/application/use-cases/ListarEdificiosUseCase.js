const edificioRepository = require('../../infrastructure/repositories/FirestoreEdificioRepository');

class ListarEdificiosUseCase {
  constructor(repo = edificioRepository) {
    this.repo = repo;
  }

  async execute() {
    return this.repo.obtenerTodos();
  }

  async executeById(id) {
    return this.repo.obtenerPorId(id);
  }

  async executeByNombre(nombre) {
    return this.repo.obtenerPorNombre(nombre);
  }
}

module.exports = new ListarEdificiosUseCase();
