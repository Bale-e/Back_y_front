const express = require('express');
const router = express.Router();
const controller = require('../controllers/FirestoreAdminController');
const { requireAdmin } = require('../middlewares/adminAuth');
const { adminLimiter, adminLoginLimiter } = require('../middlewares/rateLimits');

// Verificación de credenciales (login rápido con rate limit estricto)
router.post('/verificar', adminLoginLimiter, requireAdmin, (req, res) => res.json({ ok: true }));

// Todas las rutas a continuación exigen token de administrador
router.use(adminLimiter);
router.use(requireAdmin);

// ── Estado y Diagnóstico de Firebase ──────────────────────────
router.get('/stats', controller.getStatus);
router.post('/cache/clear', controller.clearCache);

// ── Explorador / Consola de Firestore Genérica ────────────────
router.get('/firestore/collections', controller.listCollections);
router.get('/firestore/documents', controller.listDocuments);
router.get('/firestore/document', controller.getDocument);
router.post('/firestore/document', controller.saveDocument);
router.put('/firestore/document', controller.saveDocument);
router.delete('/firestore/document', controller.deleteDocument);

// ── Gestión Integral de Locaciones (Salas / Espacios) ─────────
router.get('/locaciones/todas', controller.listAllLocationsDetailed);
router.post('/locaciones', controller.createLocation);
router.put('/locaciones', controller.updateLocation);
router.delete('/locaciones', controller.deleteLocation);

// ── Gestión de Rutas y Navegación ─────────────────────────────
router.get('/rutas/todas', controller.listNavigationData);
router.post('/rutas/document', controller.saveNavigationDocument);
router.delete('/rutas/document', controller.deleteNavigationDocument);

module.exports = router;
