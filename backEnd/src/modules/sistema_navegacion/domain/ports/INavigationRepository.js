/**
 * Puerto de Salida (Driven Port): Repositorio de Navigation Paths y Grafo
 */
class INavigationRepository {
  async obtenerTodosLosPaths() {
    throw new Error('Método no implementado: obtenerTodosLosPaths');
  }

  async obtenerPathPorPiso(piso) {
    throw new Error('Método no implementado: obtenerPathPorPiso');
  }

  async obtenerRutasAntiguas() {
    throw new Error('Método no implementado: obtenerRutasAntiguas');
  }
}

module.exports = INavigationRepository;
