const NotFoundError = require('../../../../shared/domain/errors/NotFoundError');
const EdificioDocumentMapper = require('../../infrastructure/mappers/EdificioDocumentMapper');

class ActualizarEdificioUseCase {
  constructor(edificioRepository) {
    this.repo = edificioRepository;
  }

  async execute(id, datos) {
    const existe = await this.repo.obtenerPorId(id);
    if (!existe) {
      throw new NotFoundError(`Edificio con ID '${id}' no encontrado`);
    }
    const actualizado = await this.repo.actualizar(id, datos);
    return EdificioDocumentMapper.toResponseDto(actualizado);
  }
}

module.exports = ActualizarEdificioUseCase;
