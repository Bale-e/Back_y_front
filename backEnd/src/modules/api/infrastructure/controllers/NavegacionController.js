const calcularRutaUseCase = require('../../../sistema_navegacion/application/use-cases/CalcularRutaUseCase');
const generarVisualizacionRutaUseCase = require('../../../visualizacion_mapa/application/use-cases/GenerarVisualizacionRutaUseCase');
const navigationRepository = require('../../../sistema_navegacion/infrastructure/repositories/FirestoreNavigationRepository');

class NavegacionController {
  /**
   * Endpoint: GET /navegacion/ruta?origen=...&destino=...&piso=...&edificio=...
   */
  static async calcularRuta(req, res, next) {
    try {
      const { origen, destino, piso, edificio } = req.query;

      if (!destino) {
        return res.status(400).json({ error: 'El parámetro "destino" es obligatorio.' });
      }

      const rutaCalculada = await calcularRutaUseCase.executeRutaHaciaDestino(destino, {
        startName: origen,
        piso,
        edificio,
      });

      if (!rutaCalculada) {
        return res.status(404).json({ error: `No se pudo encontrar una ruta hacia '${destino}'` });
      }

      // Enriquecer con visualización (flechas, waypoints, polilínea suavizada)
      const visualizacion = await generarVisualizacionRutaUseCase.execute(rutaCalculada.coordinates, {
        piso: piso || 'Piso 1',
        edificio: edificio || 'A',
        startName: rutaCalculada.startName,
        endName: rutaCalculada.endName,
      });

      res.json({
        ...rutaCalculada,
        visualizacion,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrocompatibilidad con GET /ruta/:destino
   */
  static async obtenerRutaHaciaDestino(req, res, next) {
    try {
      const destino = req.params.destino;
      const { origen, startName, edificio, piso } = req.query;

      const ruta = await calcularRutaUseCase.executeRutaHaciaDestino(destino, {
        startName: origen || startName,
        edificio,
        piso,
      });

      if (!ruta) {
        return res.status(404).json({ error: `No se pudo calcular una ruta para el destino '${destino}'` });
      }

      res.json(ruta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint: GET /navigation-paths
   */
  static async listarNavigationPaths(req, res, next) {
    try {
      const paths = await navigationRepository.obtenerTodosLosPaths();
      res.json(paths);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint: GET /navigation-paths/piso/:piso
   */
  static async obtenerNavigationPathPorPiso(req, res, next) {
    try {
      const path = await navigationRepository.obtenerPathPorPiso(req.params.piso);
      if (!path) {
        return res.status(404).json({ error: 'No hay navigation-path para ese piso' });
      }
      res.json(path);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint: GET /rutas
   */
  static async listarRutasAntiguas(req, res, next) {
    try {
      const rutas = await navigationRepository.obtenerRutasAntiguas();
      res.json(rutas);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = NavegacionController;
