const buscarLocacionUseCase = require('../../../gestion_espacios/application/use-cases/BuscarLocacionUseCase');

async function listarLocacionesDeEdificio(req, res) {
  try {
    const data = await buscarLocacionUseCase.executePorEdificio(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener locaciones: ' + error.message });
  }
}

async function listarLocacionesPorPiso(req, res) {
  try {
    const data = await buscarLocacionUseCase.executePorPiso(req.params.id, req.params.piso);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al filtrar por piso: ' + error.message });
  }
}

async function listarLocacionesPorTipo(req, res) {
  try {
    const data = await buscarLocacionUseCase.executePorTipo(req.params.id, req.params.tipo);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al filtrar por tipo: ' + error.message });
  }
}

async function obtenerLocacionPorNombreEnEdificio(req, res) {
  try {
    const encontrada = await buscarLocacionUseCase.executePorNombreEnEdificio(req.params.id, req.params.nombre);
    if (!encontrada) {
      return res.status(404).json({ error: 'Locación no encontrada' });
    }
    res.json(encontrada);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar locación: ' + error.message });
  }
}

async function buscarLocacionGlobal(req, res) {
  try {
    const encontrada = await buscarLocacionUseCase.executeGlobal(req.params.nombre);
    if (!encontrada) {
      return res.status(404).json({ error: 'Locación no encontrada en ningún edificio' });
    }
    res.json(encontrada);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar locación por nombre: ' + error.message });
  }
}

async function buscarLocacionesGlobalPorPiso(req, res) {
  try {
    const data = await buscarLocacionUseCase.executeGlobalPorPiso(req.params.piso);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar locaciones por piso: ' + error.message });
  }
}

async function buscarLocacionesGlobalPorTipo(req, res) {
  try {
    const data = await buscarLocacionUseCase.executeGlobalPorTipo(req.params.tipo);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar locaciones por tipo: ' + error.message });
  }
}

async function buscarLocacionesGlobalPorCuerpo(req, res) {
  try {
    const encontrada = await buscarLocacionUseCase.executeGlobalPorCuerpo(req.params.cuerpo);
    if (!encontrada) {
      return res.status(404).json({ error: 'Locación no encontrada para el cuerpo especificado' });
    }
    res.json(encontrada);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar locación por cuerpo: ' + error.message });
  }
}

module.exports = {
  listarLocacionesDeEdificio,
  listarLocacionesPorPiso,
  listarLocacionesPorTipo,
  obtenerLocacionPorNombreEnEdificio,
  buscarLocacionGlobal,
  buscarLocacionesGlobalPorPiso,
  buscarLocacionesGlobalPorTipo,
  buscarLocacionesGlobalPorCuerpo,
};
