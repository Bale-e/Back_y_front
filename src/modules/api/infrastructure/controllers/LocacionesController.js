const buscarLocacionUseCase = require('../../../gestion_espacios/application/use-cases/BuscarLocacionUseCase');
const LocacionDocumentMapper = require('../../../gestion_espacios/infrastructure/mappers/LocacionDocumentMapper');

// Normaliza un documento crudo (o un array de ellos) al DTO de respuesta
function toDto(data) {
  if (data == null) return null;
  if (Array.isArray(data)) {
    return data.map((item) => LocacionDocumentMapper.toResponseDto(LocacionDocumentMapper.toDomain(item)));
  }
  return LocacionDocumentMapper.toResponseDto(LocacionDocumentMapper.toDomain(data));
}

async function listarLocacionesDeEdificio(req, res) {
  try {
    const data = await buscarLocacionUseCase.executePorEdificio(req.params.id);
    res.json(toDto(data));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener locaciones: ' + error.message });
  }
}

async function listarLocacionesPorPiso(req, res) {
  try {
    const data = await buscarLocacionUseCase.executePorPiso(req.params.id, req.params.piso);
    res.json(toDto(data));
  } catch (error) {
    res.status(500).json({ error: 'Error al filtrar por piso: ' + error.message });
  }
}

async function listarLocacionesPorTipo(req, res) {
  try {
    const data = await buscarLocacionUseCase.executePorTipo(req.params.id, req.params.tipo);
    res.json(toDto(data));
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
    res.json(toDto(encontrada));
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
    res.json(toDto(encontrada));
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar locación por nombre: ' + error.message });
  }
}

async function buscarLocacionesGlobalPorPiso(req, res) {
  try {
    const data = await buscarLocacionUseCase.executeGlobalPorPiso(req.params.piso);
    res.json(toDto(data));
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar locaciones por piso: ' + error.message });
  }
}

async function buscarLocacionesGlobalPorTipo(req, res) {
  try {
    const data = await buscarLocacionUseCase.executeGlobalPorTipo(req.params.tipo);
    res.json(toDto(data));
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
    res.json(toDto(encontrada));   // 👈 fix aplicado aquí
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