const locacionRepository = require('../../infrastructure/repositories/FirestoreLocacionRepository');

class BuscarLocacionUseCase {
  constructor(repo = locacionRepository) {
    this.repo = repo;
  }

  async executePorEdificio(edificioId) {
    return this.repo.obtenerPorEdificio(edificioId);
  }

  async executePorPiso(edificioId, piso) {
    return this.repo.obtenerPorEdificioYPiso(edificioId, piso);
  }

  async executePorTipo(edificioId, tipo) {
    return this.repo.obtenerPorEdificioYTipo(edificioId, tipo);
  }

  async executePorNombreEnEdificio(edificioId, nombre) {
    return this.repo.obtenerPorNombreEnEdificio(edificioId, nombre);
  }

  async executeGlobal(nombre) {
    return this.repo.buscarGlobalPorNombre(nombre);
  }

  async executeGlobalPorPiso(piso) {
    return this.repo.buscarGlobalPorPiso(piso);
  }

  async executeGlobalPorTipo(tipo) {
    return this.repo.buscarGlobalPorTipo(tipo);
  }

  async executeGlobalPorCuerpo(cuerpo) {
    return this.repo.buscarGlobalPorCuerpo(cuerpo);
  }
}

module.exports = new BuscarLocacionUseCase();
