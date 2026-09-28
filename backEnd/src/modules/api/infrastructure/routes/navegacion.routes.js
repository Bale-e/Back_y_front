const express = require('express');
const router = express.Router();
const NavegacionController = require('../controllers/NavegacionController');

// Ruta principal de navegación y cálculo enriquecido
router.get('/ruta', NavegacionController.calcularRuta);

// Alias de ruta hacia destino
router.get('/ruta/:destino', NavegacionController.obtenerRutaHaciaDestino);

module.exports = router;
