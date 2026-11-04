const listarEdificiosUseCase = require('../../../gestion_espacios/application/use-cases/ListarEdificiosUseCase');
const obtenerEdificioPorIdUseCase = require('../../../gestion_espacios/application/use-cases/ObtenerEdificioPorIdUseCase');
const CrearEdificioUseCase = require('../../../gestion_espacios/application/use-cases/CrearEdificioUseCase');
const ActualizarEdificioUseCase = require('../../../gestion_espacios/application/use-cases/ActualizarEdificioUseCase');
const EliminarEdificioUseCase = require('../../../gestion_espacios/application/use-cases/EliminarEdificioUseCase');
const firestoreEdificioRepository = require('../../../gestion_espacios/infrastructure/repositories/FirestoreEdificioRepository');

const crearEdificioUseCase = new CrearEdificioUseCase(firestoreEdificioRepository);
const actualizarEdificioUseCase = new ActualizarEdificioUseCase(firestoreEdificioRepository);
const eliminarEdificioUseCase = new EliminarEdificioUseCase(firestoreEdificioRepository);

async function listarEdificios(req, res, next) {
  try {
    const data = await listarEdificiosUseCase.execute();
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function obtenerEdificioPorId(req, res, next) {
  try {
    const encontrado = await obtenerEdificioPorIdUseCase.execute(req.params.id);
    if (!encontrado) {
      return res.status(404).json({ error: 'Edificio no encontrado' });
    }
    res.json(encontrado);
  } catch (error) {
    next(error);
  }
}

async function obtenerEdificioPorNombre(req, res, next) {
  try {
    const encontrado = await listarEdificiosUseCase.executeByNombre(req.params.nombre);
    if (!encontrado) {
      return res.status(404).json({ error: 'Edificio no encontrado' });
    }
    res.json(encontrado);
  } catch (error) {
    next(error);
  }
}

async function crearEdificio(req, res, next) {
  try {
    const datos = req.body;
    if (!datos || (!datos.nombre && !datos.Nombre)) {
      return res.status(400).json({ error: 'El nombre del edificio es obligatorio' });
    }
    const nuevo = await crearEdificioUseCase.execute(datos);
    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
}

async function actualizarEdificio(req, res, next) {
  try {
    const { id } = req.params;
    const datos = req.body;
    const actualizado = await actualizarEdificioUseCase.execute(id, datos);
    res.json(actualizado);
  } catch (error) {
    next(error);
  }
}

async function eliminarEdificio(req, res, next) {
  try {
    const { id } = req.params;
    const resultado = await eliminarEdificioUseCase.execute(id);
    res.json(resultado);
  } catch (error) {
    next(error);
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
