const NotFoundError = require('../../../../shared/domain/errors/NotFoundError');

class EliminarEdificioUseCase {
  constructor(edificioRepository) {
    this.repo = edificioRepository;
  }

  async execute(id) {
    const existe = await this.repo.obtenerPorId(id);
    if (!existe) {
      throw new NotFoundError(`Edificio con ID '${id}' no encontrado`);
    }
    return this.repo.eliminar(id);
  }
}

module.exports = EliminarEdificioUseCase;
