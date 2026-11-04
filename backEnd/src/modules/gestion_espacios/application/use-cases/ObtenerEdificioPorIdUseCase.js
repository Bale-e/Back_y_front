const edificioRepository = require('../../infrastructure/repositories/FirestoreEdificioRepository');
const EdificioDocumentMapper = require('../../infrastructure/mappers/EdificioDocumentMapper');

class ObtenerEdificioPorIdUseCase {
  constructor(repo = edificioRepository) {
    this.repo = repo;
  }

  async execute(id) {
    const edificio = await this.repo.obtenerPorId(id);
    return EdificioDocumentMapper.toResponseDto(edificio);
  }
}

module.exports = new ObtenerEdificioPorIdUseCase();
