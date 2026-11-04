const defaultLocacionRepository = require('../../infrastructure/repositories/FirestoreLocacionRepository');
const LocacionDocumentMapper = require('../../infrastructure/mappers/LocacionDocumentMapper');

class BuscarLocacionUseCase {
  constructor(repo = defaultLocacionRepository) {
    this.repo = repo;
  }

  _toDto(loc) {
    return LocacionDocumentMapper.toResponseDto(loc);
  }

  _toDtoList(list = []) {
    return list.map((item) => LocacionDocumentMapper.toResponseDto(item)).filter(Boolean);
  }

  async executePorEdificio(edificioId) {
    const list = await this.repo.obtenerPorEdificio(edificioId);
    return this._toDtoList(list);
  }

  async executePorPiso(edificioId, piso) {
    const list = await this.repo.obtenerPorEdificioYPiso(edificioId, piso);
    return this._toDtoList(list);
  }

  async executePorTipo(edificioId, tipo) {
    const list = await this.repo.obtenerPorEdificioYTipo(edificioId, tipo);
    return this._toDtoList(list);
  }

  async executePorNombreEnEdificio(edificioId, nombre) {
    const loc = await this.repo.obtenerPorNombreEnEdificio(edificioId, nombre);
    return this._toDto(loc);
  }

  async executeGlobal(nombre) {
    const loc = await this.repo.buscarGlobalPorNombre(nombre);
    return this._toDto(loc);
  }

  async executeGlobalPorPiso(piso) {
    const list = await this.repo.buscarGlobalPorPiso(piso);
    return this._toDtoList(list);
  }

  async executeGlobalPorTipo(tipo) {
    const list = await this.repo.buscarGlobalPorTipo(tipo);
    return this._toDtoList(list);
  }

  async executeGlobalPorCuerpo(cuerpo) {
    const loc = await this.repo.buscarGlobalPorCuerpo(cuerpo);
    return this._toDto(loc);
  }
}

module.exports = new BuscarLocacionUseCase();
