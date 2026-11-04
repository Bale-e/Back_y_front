const edificioRepository = require('../../infrastructure/repositories/FirestoreEdificioRepository');
const EdificioDocumentMapper = require('../../infrastructure/mappers/EdificioDocumentMapper');

class ListarEdificiosUseCase {
  constructor(repo = edificioRepository) {
    this.repo = repo;
  }

  async execute() {
    const edificios = await this.repo.obtenerTodos();
    return edificios.map((e) => EdificioDocumentMapper.toResponseDto(e));
  }

  async executeById(id) {
    const edificio = await this.repo.obtenerPorId(id);
    return EdificioDocumentMapper.toResponseDto(edificio);
  }

  async executeByNombre(nombre) {
    const edificio = await this.repo.obtenerPorNombre(nombre);
    return EdificioDocumentMapper.toResponseDto(edificio);
  }

  async crear(datos) {
    const creado = await this.repo.crear(datos);
    return EdificioDocumentMapper.toResponseDto(creado);
  }

  async actualizar(id, datos) {
    const actualizado = await this.repo.actualizar(id, datos);
    return EdificioDocumentMapper.toResponseDto(actualizado);
  }

  async eliminar(id) {
    return this.repo.eliminar(id);
  }
}

module.exports = new ListarEdificiosUseCase();
