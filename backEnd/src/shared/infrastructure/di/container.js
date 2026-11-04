/**
 * Composition Root / Dependency Injection Container
 * Centraliza la instanciación e inyección de dependencias respetando la
 * inversión de dependencias de la Arquitectura Hexagonal.
 */

// ── Repositorios (Infraestructura) ───────────────────────────
const firestoreEdificioRepository = require('../../../modules/gestion_espacios/infrastructure/repositories/FirestoreEdificioRepository');
const firestoreLocacionRepository = require('../../../modules/gestion_espacios/infrastructure/repositories/FirestoreLocacionRepository');
const firestoreNavigationRepository = require('../../../modules/sistema_navegacion/infrastructure/repositories/FirestoreNavigationRepository');

// ── Servicios del Dominio ────────────────────────────────────
const aStarAlgorithm = require('../../../modules/sistema_navegacion/domain/services/AStarAlgorithm');
const arrowDirectionCalculator = require('../../../modules/visualizacion_mapa/domain/services/ArrowDirectionCalculator');
const polylineSmoother = require('../../../modules/visualizacion_mapa/domain/services/PolylineSmoother');

// ── Casos de Uso (Aplicación) ────────────────────────────────
const ListarEdificiosUseCase = require('../../../modules/gestion_espacios/application/use-cases/ListarEdificiosUseCase');
const ObtenerEdificioPorIdUseCase = require('../../../modules/gestion_espacios/application/use-cases/ObtenerEdificioPorIdUseCase');
const CrearEdificioUseCase = require('../../../modules/gestion_espacios/application/use-cases/CrearEdificioUseCase');
const ActualizarEdificioUseCase = require('../../../modules/gestion_espacios/application/use-cases/ActualizarEdificioUseCase');
const EliminarEdificioUseCase = require('../../../modules/gestion_espacios/application/use-cases/EliminarEdificioUseCase');
const BuscarLocacionUseCase = require('../../../modules/gestion_espacios/application/use-cases/BuscarLocacionUseCase');
const CalcularRutaUseCase = require('../../../modules/sistema_navegacion/application/use-cases/CalcularRutaUseCase');
const GenerarVisualizacionRutaUseCase = require('../../../modules/visualizacion_mapa/application/use-cases/GenerarVisualizacionRutaUseCase');

class Container {
  constructor() {
    this.services = new Map();
    this._registerDefaults();
  }

  _registerDefaults() {
    // Repositorios
    this.services.set('edificioRepository', firestoreEdificioRepository);
    this.services.set('locacionRepository', firestoreLocacionRepository);
    this.services.set('navigationRepository', firestoreNavigationRepository);

    // Servicios de Dominio
    this.services.set('aStarAlgorithm', aStarAlgorithm);
    this.services.set('arrowDirectionCalculator', arrowDirectionCalculator);
    this.services.set('polylineSmoother', polylineSmoother);

    // Casos de Uso
    this.services.set('listarEdificiosUseCase', new ListarEdificiosUseCase(firestoreEdificioRepository));
    this.services.set('obtenerEdificioPorIdUseCase', new ObtenerEdificioPorIdUseCase(firestoreEdificioRepository));
    this.services.set('crearEdificioUseCase', new CrearEdificioUseCase(firestoreEdificioRepository));
    this.services.set('actualizarEdificioUseCase', new ActualizarEdificioUseCase(firestoreEdificioRepository));
    this.services.set('eliminarEdificioUseCase', new EliminarEdificioUseCase(firestoreEdificioRepository));
    this.services.set('buscarLocacionUseCase', new BuscarLocacionUseCase(firestoreLocacionRepository));
    this.services.set(
      'calcularRutaUseCase',
      new CalcularRutaUseCase(firestoreNavigationRepository, firestoreLocacionRepository, aStarAlgorithm)
    );
    this.services.set(
      'generarVisualizacionRutaUseCase',
      new GenerarVisualizacionRutaUseCase(arrowDirectionCalculator, polylineSmoother)
    );
  }

  get(name) {
    if (!this.services.has(name)) {
      throw new Error(`Servicio '${name}' no registrado en el contenedor DI`);
    }
    return this.services.get(name);
  }

  register(name, instance) {
    this.services.set(name, instance);
  }
}

const container = new Container();

module.exports = container;
