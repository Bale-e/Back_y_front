const buscarLocacionUseCase = require('../../../gestion_espacios/application/use-cases/BuscarLocacionUseCase');

async function listarLocacionesDeEdificio(req, res, next) {
  try {
    const data = await buscarLocacionUseCase.executePorEdificio(req.params.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function listarLocacionesPorPiso(req, res, next) {
  try {
    const data = await buscarLocacionUseCase.executePorPiso(req.params.id, req.params.piso);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function listarLocacionesPorTipo(req, res, next) {
  try {
    const data = await buscarLocacionUseCase.executePorTipo(req.params.id, req.params.tipo);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function obtenerLocacionPorNombreEnEdificio(req, res, next) {
  try {
    const encontrada = await buscarLocacionUseCase.executePorNombreEnEdificio(req.params.id, req.params.nombre);
    if (!encontrada) {
      return res.status(404).json({ error: 'Locación no encontrada' });
    }
    res.json(encontrada);
  } catch (error) {
    next(error);
  }
}

async function buscarLocacionGlobal(req, res, next) {
  try {
    const encontrada = await buscarLocacionUseCase.executeGlobal(req.params.nombre);
    if (!encontrada) {
      return res.status(404).json({ error: `Locación '${req.params.nombre}' no encontrada` });
    }
    res.json(encontrada);
  } catch (error) {
    next(error);
  }
}

async function buscarLocacionesGlobalPorPiso(req, res, next) {
  try {
    const data = await buscarLocacionUseCase.executeGlobalPorPiso(req.params.piso);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function buscarLocacionesGlobalPorTipo(req, res, next) {
  try {
    const data = await buscarLocacionUseCase.executeGlobalPorTipo(req.params.tipo);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function buscarLocacionesGlobalPorCuerpo(req, res, next) {
  try {
    const encontrada = await buscarLocacionUseCase.executeGlobalPorCuerpo(req.params.cuerpo);
    if (!encontrada) {
      return res.status(404).json({ error: `No se encontró locación para el cuerpo '${req.params.cuerpo}'` });
    }
    res.json(encontrada);
  } catch (error) {
    next(error);
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
