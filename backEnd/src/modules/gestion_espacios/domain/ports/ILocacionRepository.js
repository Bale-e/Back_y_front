/**
 * Puerto de Salida (Driven Port): Repositorio de Locaciones
 */
class ILocacionRepository {
  async obtenerPorEdificio(edificioId) {
    throw new Error('Método no implementado: obtenerPorEdificio');
  }

  async obtenerPorEdificioYPiso(edificioId, piso) {
    throw new Error('Método no implementado: obtenerPorEdificioYPiso');
  }

  async obtenerPorEdificioYTipo(edificioId, tipo) {
    throw new Error('Método no implementado: obtenerPorEdificioYTipo');
  }

  async obtenerPorNombreEnEdificio(edificioId, nombre) {
    throw new Error('Método no implementado: obtenerPorNombreEnEdificio');
  }

  async buscarGlobalPorNombre(nombre) {
    throw new Error('Método no implementado: buscarGlobalPorNombre');
  }

  async buscarGlobalPorPiso(piso) {
    throw new Error('Método no implementado: buscarGlobalPorPiso');
  }

  async buscarGlobalPorTipo(tipo) {
    throw new Error('Método no implementado: buscarGlobalPorTipo');
  }

  async buscarGlobalPorCuerpo(cuerpo) {
    throw new Error('Método no implementado: buscarGlobalPorCuerpo');
  }
}

module.exports = ILocacionRepository;
