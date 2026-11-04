const ValidationError = require('../../../../shared/domain/errors/ValidationError');
const EdificioDocumentMapper = require('../../infrastructure/mappers/EdificioDocumentMapper');

class CrearEdificioUseCase {
  constructor(edificioRepository) {
    this.repo = edificioRepository;
  }

  async execute(datos) {
    if (!datos || (!datos.nombre && !datos.Nombre)) {
      throw new ValidationError('El nombre del edificio es obligatorio');
    }
    const creado = await this.repo.crear(datos);
    return EdificioDocumentMapper.toResponseDto(creado);
  }
}

module.exports = CrearEdificioUseCase;
