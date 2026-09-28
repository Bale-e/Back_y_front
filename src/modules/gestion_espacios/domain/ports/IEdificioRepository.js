/**
 * Puerto de Salida (Driven Port): Repositorio de Edificios
 */
class IEdificioRepository {
  async obtenerTodos() {
    throw new Error('Método no implementado: obtenerTodos');
  }

  async obtenerPorId(id) {
    throw new Error('Método no implementado: obtenerPorId');
  }

  async obtenerPorNombre(nombre) {
    throw new Error('Método no implementado: obtenerPorNombre');
  }
}

module.exports = IEdificioRepository;
