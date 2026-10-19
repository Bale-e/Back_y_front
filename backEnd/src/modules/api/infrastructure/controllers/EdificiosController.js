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

async function crearEdificio(req, res) {
  try {
    const datos = req.body;
    if (!datos || (!datos.nombre && !datos.Nombre)) {
      return res.status(400).json({ error: 'El nombre del edificio es obligatorio' });
    }
    const nuevo = await listarEdificiosUseCase.crear(datos);
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear edificio: ' + error.message });
  }
}

async function actualizarEdificio(req, res) {
  try {
    const { id } = req.params;
    const datos = req.body;
    const actualizado = await listarEdificiosUseCase.actualizar(id, datos);
    res.json(actualizado);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar edificio: ' + error.message });
  }
}

async function eliminarEdificio(req, res) {
  try {
    const { id } = req.params;
    const resultado = await listarEdificiosUseCase.eliminar(id);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar edificio: ' + error.message });
  }
}

module.exports = {
  listarEdificios,
  obtenerEdificioPorId,
  obtenerEdificioPorNombre,
  crearEdificio,
  actualizarEdificio,
  eliminarEdificio,
};
