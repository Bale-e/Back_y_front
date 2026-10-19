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

  async crear(datos) {
    throw new Error('Método no implementado: crear');
  }

  async actualizar(id, datos) {
    throw new Error('Método no implementado: actualizar');
  }

  async eliminar(id) {
    throw new Error('Método no implementado: eliminar');
  }
}

module.exports = IEdificioRepository;
