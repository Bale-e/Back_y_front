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

  async crear(datos) {
    return this.repo.crear(datos);
  }

  async actualizar(id, datos) {
    return this.repo.actualizar(id, datos);
  }

  async eliminar(id) {
    return this.repo.eliminar(id);
  }
}

module.exports = new ListarEdificiosUseCase();
