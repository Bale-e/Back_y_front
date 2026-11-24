const express = require('express');
const router = express.Router();
const {
  listarEdificios,
  obtenerEdificioPorId,
  obtenerEdificioPorNombre,
  crearEdificio,
  actualizarEdificio,
  eliminarEdificio,
} = require('../controllers/EdificiosController');
const {
  listarLocacionesDeEdificio,
  listarLocacionesPorPiso,
  listarLocacionesPorTipo,
  obtenerLocacionPorNombreEnEdificio,
} = require('../controllers/LocacionesController');
const { requireAdmin } = require('../middlewares/adminAuth');
const { adminLimiter } = require('../middlewares/rateLimits');
const { validarEdificio, validarIdDocumento } = require('../middlewares/validateEdificio');

router.get('/', listarEdificios);
router.get('/nombre/:nombre', obtenerEdificioPorNombre);
router.get('/:id', obtenerEdificioPorId);

// Métodos de Administración (CRUD): requieren ADMIN_TOKEN (ver adminAuth.js),
// pocos intentos por IP y un cuerpo validado (solo campos conocidos).
router.post('/', adminLimiter, requireAdmin, validarEdificio(), crearEdificio);
router.put('/:id', adminLimiter, requireAdmin, validarIdDocumento, validarEdificio({ parcial: true }), actualizarEdificio);
router.delete('/:id', adminLimiter, requireAdmin, validarIdDocumento, eliminarEdificio);

// Locaciones anidadas bajo un edificio: /edificios/:id/locaciones...
router.get('/:id/locaciones', listarLocacionesDeEdificio);
router.get('/:id/locaciones/piso/:piso', listarLocacionesPorPiso);
router.get('/:id/locaciones/tipo/:tipo', listarLocacionesPorTipo);
router.get('/:id/locaciones/nombre/:nombre', obtenerLocacionPorNombreEnEdificio);

module.exports = router;
