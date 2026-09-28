const calcularRutaUseCase = require('../../../sistema_navegacion/application/use-cases/CalcularRutaUseCase');
const generarVisualizacionRutaUseCase = require('../../../visualizacion_mapa/application/use-cases/GenerarVisualizacionRutaUseCase');
const ApiResponse = require('../../presentation/view-models/ApiResponse');

class NavegacionController {
  /**
   * Endpoint: GET /navegacion/ruta?origen=...&destino=...&piso=...&edificio=...
   */
  static async calcularRuta(req, res) {
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
      res.status(500).json({ error: 'Error al calcular la ruta de navegación: ' + error.message });
    }
  }

  /**
   * Retrocompatibilidad con GET /ruta/:destino
   */
  static async obtenerRutaHaciaDestino(req, res) {
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
      res.status(500).json({ error: 'Error al calcular la ruta: ' + error.message });
    }
  }
}

module.exports = NavegacionController;
