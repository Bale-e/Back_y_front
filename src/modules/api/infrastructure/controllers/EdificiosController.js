const listarEdificiosUseCase = require('../../../gestion_espacios/application/use-cases/ListarEdificiosUseCase');
const obtenerEdificioPorIdUseCase = require('../../../gestion_espacios/application/use-cases/ObtenerEdificioPorIdUseCase');

async function listarEdificios(req, res) {
  try {
    const data = await listarEdificiosUseCase.execute();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener edificios: ' + error.message });
  }
}

async function obtenerEdificioPorId(req, res) {
  try {
    const encontrado = await obtenerEdificioPorIdUseCase.execute(req.params.id);
    if (!encontrado) {
      return res.status(404).json({ error: 'Edificio no encontrado' });
    }
    res.json(encontrado);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener edificio: ' + error.message });
  }
}

async function obtenerEdificioPorNombre(req, res) {
  try {
    const encontrado = await listarEdificiosUseCase.executeByNombre(req.params.nombre);
    if (!encontrado) {
      return res.status(404).json({ error: 'Edificio no encontrado' });
    }
    res.json(encontrado);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar edificio por nombre: ' + error.message });
  }
}

module.exports = {
  listarEdificios,
  obtenerEdificioPorId,
  obtenerEdificioPorNombre,
};
