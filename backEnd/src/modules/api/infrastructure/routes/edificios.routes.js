const express = require('express');
const router = express.Router();
const {
  listarEdificios,
  obtenerEdificioPorId,
  obtenerEdificioPorNombre,
} = require('../controllers/EdificiosController');
const {
  listarLocacionesDeEdificio,
  listarLocacionesPorPiso,
  listarLocacionesPorTipo,
  obtenerLocacionPorNombreEnEdificio,
} = require('../controllers/LocacionesController');

router.get('/', listarEdificios);
router.get('/nombre/:nombre', obtenerEdificioPorNombre);
router.get('/:id', obtenerEdificioPorId);

// Locaciones anidadas bajo un edificio: /edificios/:id/locaciones...
router.get('/:id/locaciones', listarLocacionesDeEdificio);
router.get('/:id/locaciones/piso/:piso', listarLocacionesPorPiso);
router.get('/:id/locaciones/tipo/:tipo', listarLocacionesPorTipo);
router.get('/:id/locaciones/nombre/:nombre', obtenerLocacionPorNombreEnEdificio);

module.exports = router;
