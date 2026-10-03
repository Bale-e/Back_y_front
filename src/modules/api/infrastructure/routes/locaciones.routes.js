const express = require('express');
const router = express.Router();
const {
  buscarLocacionGlobal,
  buscarLocacionesGlobalPorPiso,
  buscarLocacionesGlobalPorTipo,
  buscarLocacionesGlobalPorCuerpo,
} = require('../controllers/LocacionesController');

// Búsquedas globales sin necesidad de conocer el ID del edificio
router.get('/piso/:piso', buscarLocacionesGlobalPorPiso);
router.get('/tipo/:tipo', buscarLocacionesGlobalPorTipo);
router.get('/cuerpo/:cuerpo', buscarLocacionesGlobalPorCuerpo);
router.get('/:nombre', buscarLocacionGlobal);

module.exports = router;
