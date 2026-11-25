const { db } = require('../../../../shared/infrastructure/firebase/firebaseAdmin');
const { invalidateAll } = require('../../../../shared/infrastructure/cache/MemoryCacheAdapter');
const { COLECCIONES_LOCACIONES, getFieldCI } = require('../../../gestion_espacios/infrastructure/helpers/firestoreHelpers');

class FirestoreAdminController {
  // ── 1. ESTADO Y DIAGNÓSTICO DE FIREBASE ────────────────────────
  async getStatus(req, res, next) {
    try {
      const t0 = Date.now();
      // Test de lectura contra Firestore
      const testSnap = await db.collection('Edificios').limit(1).get();
      const latencyMs = Date.now() - t0;

      // Obtener colecciones raíz
      const rootCollections = await db.listCollections();
      const collectionNames = rootCollections.map((c) => c.id);

      // Conteo de edificios
      const edificiosSnap = await db.collection('Edificios').get();
      const edificiosCount = edificiosSnap.size;

      res.json({
        ok: true,
        connected: true,
        latencyMs,
        timestamp: new Date().toISOString(),
        projectId: process.env.FIREBASE_PROJECT_ID || 'Configurado',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'Configurado',
        collections: collectionNames,
        stats: {
          edificios: edificiosCount,
          subcoleccionesConocidas: COLECCIONES_LOCACIONES,
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        connected: false,
        error: error.message || 'Error al comunicarse con Firebase Firestore',
      });
    }
  }

  async clearCache(req, res, next) {
    try {
      invalidateAll();
      res.json({ ok: true, message: 'Caché en memoria invalidada exitosamente.' });
    } catch (error) {
      next(error);
    }
  }

  // ── 2. CONSOLA / EXPLORADOR DE FIRESTORE (GENÉRICO) ────────────
  async listCollections(req, res, next) {
    try {
      const { parentPath } = req.query;
      if (parentPath && parentPath.trim().length > 0) {
        const docRef = db.doc(parentPath.trim());
        const subcollections = await docRef.listCollections();
        return res.json(subcollections.map((c) => c.id));
      }
      const collections = await db.listCollections();
      res.json(collections.map((c) => c.id));
    } catch (error) {
      next(error);
    }
  }

  async listDocuments(req, res, next) {
    try {
      const collectionPath = req.query.collectionPath || req.query.path;
      if (!collectionPath) {
        return res.status(400).json({ error: 'Falta el parámetro "collectionPath"' });
      }

      const limit = Math.min(Number(req.query.limit) || 100, 300);
      const snapshot = await db.collection(collectionPath.trim()).limit(limit).get();

      const documents = snapshot.docs.map((doc) => ({
        id: doc.id,
        path: doc.ref.path,
        data: doc.data(),
      }));

      res.json({
        collectionPath: collectionPath.trim(),
        count: documents.length,
        documents,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDocument(req, res, next) {
    try {
      const documentPath = req.query.documentPath || req.query.path;
      if (!documentPath) {
        return res.status(400).json({ error: 'Falta el parámetro "documentPath"' });
      }

      const docRef = db.doc(documentPath.trim());
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: `Documento no encontrado en ${documentPath}` });
      }

      // Buscar si tiene subcolecciones
      const subcollections = await docRef.listCollections();
      const subcollectionIds = subcollections.map((s) => s.id);

      res.json({
        id: doc.id,
        path: docRef.path,
        data: doc.data(),
        subcollections: subcollectionIds,
      });
    } catch (error) {
      next(error);
    }
  }

  async saveDocument(req, res, next) {
    try {
      const { collectionPath, documentPath, docId, data, merge = true } = req.body;

      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'El campo "data" debe ser un objeto válido.' });
      }

      let targetRef;
      if (documentPath && documentPath.trim()) {
        targetRef = db.doc(documentPath.trim());
        await targetRef.set(data, { merge: Boolean(merge) });
      } else if (collectionPath && collectionPath.trim()) {
        const colRef = db.collection(collectionPath.trim());
        if (docId && docId.trim()) {
          targetRef = colRef.doc(docId.trim());
          await targetRef.set(data, { merge: Boolean(merge) });
        } else {
          targetRef = await colRef.add(data);
        }
      } else {
        return res.status(400).json({ error: 'Se requiere "documentPath" o "collectionPath".' });
      }

      invalidateAll();

      res.json({
        ok: true,
        id: targetRef.id,
        path: targetRef.path,
        message: 'Documento guardado exitosamente en Firestore.',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteDocument(req, res, next) {
    try {
      const documentPath = req.body.documentPath || req.query.documentPath || req.query.path;
      if (!documentPath || !documentPath.trim()) {
        return res.status(400).json({ error: 'Falta "documentPath" para eliminar.' });
      }

      const docRef = db.doc(documentPath.trim());
      await docRef.delete();
      invalidateAll();

      res.json({
        ok: true,
        path: documentPath.trim(),
        message: 'Documento eliminado exitosamente de Firestore.',
      });
    } catch (error) {
      next(error);
    }
  }

  // ── 3. GESTIÓN INTEGRAL DE LOCACIONES (SALAS / ESPACIOS) ──────
  async listAllLocationsDetailed(req, res, next) {
    try {
      const edificiosSnap = await db.collection('Edificios').get();
      const results = [];

      for (const edDoc of edificiosSnap.docs) {
        const edData = edDoc.data();
        const edId = edDoc.id;
        const edNombre = edData.Nombre || edData.nombre || `Edificio ${edId}`;

        // Obtener subcolecciones existentes en este edificio
        const subcollections = await edDoc.ref.listCollections();
        const subcolNames = Array.from(
          new Set([...COLECCIONES_LOCACIONES, ...subcollections.map((s) => s.id)])
        );

        for (const subcol of subcolNames) {
          const locsSnap = await edDoc.ref.collection(subcol).get().catch(() => ({ docs: [] }));
          if (locsSnap && locsSnap.docs) {
            for (const locDoc of locsSnap.docs) {
              const data = locDoc.data();
              results.push({
                docId: locDoc.id,
                path: locDoc.ref.path,
                edificioId: edId,
                edificioNombre: edNombre,
                subcoleccion: subcol,
                nombre: getFieldCI(data, 'nombre') || getFieldCI(data, 'Nombre') || 'Sin nombre',
                tipo: getFieldCI(data, 'tipo') || getFieldCI(data, 'Tipo') || 'General',
                piso: getFieldCI(data, 'piso') || getFieldCI(data, 'Piso') || 'Piso 1',
                cuerpo: getFieldCI(data, 'cuerpo') || getFieldCI(data, 'Cuerpo') || null,
                coordenadas:
                  getFieldCI(data, 'coordenadas') ||
                  getFieldCI(data, 'Coordenadas') ||
                  getFieldCI(data, 'Coordenadas 3D') ||
                  null,
                coordenadas2D:
                  getFieldCI(data, 'coordenadas 2d') ||
                  getFieldCI(data, 'Coordenadas 2D') ||
                  null,
                rawData: data,
              });
            }
          }
        }
      }

      res.json({
        total: results.length,
        locaciones: results,
      });
    } catch (error) {
      next(error);
    }
  }

  async createLocation(req, res, next) {
    try {
      const { edificioId, subcoleccion, data, docId } = req.body;
      if (!edificioId) {
        return res.status(400).json({ error: 'El campo "edificioId" es obligatorio.' });
      }
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'El campo "data" debe ser un objeto.' });
      }

      const targetSubcol = (subcoleccion || 'Locaciones').trim();
      const colRef = db.collection('Edificios').doc(edificioId.trim()).collection(targetSubcol);

      let targetDoc;
      if (docId && docId.trim()) {
        targetDoc = colRef.doc(docId.trim());
        await targetDoc.set(data);
      } else {
        targetDoc = await colRef.add(data);
      }

      invalidateAll();

      res.status(201).json({
        ok: true,
        docId: targetDoc.id,
        path: targetDoc.path,
        message: 'Locación creada correctamente en Firestore.',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateLocation(req, res, next) {
    try {
      const { edificioId, subcoleccion, docId, data } = req.body;
      if (!edificioId || !subcoleccion || !docId) {
        return res.status(400).json({
          error: 'Los campos "edificioId", "subcoleccion" y "docId" son obligatorios.',
        });
      }
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'El campo "data" debe ser un objeto con las propiedades a actualizar.' });
      }

      const docRef = db
        .collection('Edificios')
        .doc(edificioId.trim())
        .collection(subcoleccion.trim())
        .doc(docId.trim());

      await docRef.set(data, { merge: true });
      invalidateAll();

      res.json({
        ok: true,
        docId: docRef.id,
        path: docRef.path,
        message: 'Locación actualizada correctamente en Firestore.',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteLocation(req, res, next) {
    try {
      const { edificioId, subcoleccion, docId } = req.body;
      if (!edificioId || !subcoleccion || !docId) {
        return res.status(400).json({
          error: 'Los campos "edificioId", "subcoleccion" y "docId" son obligatorios.',
        });
      }

      const docRef = db
        .collection('Edificios')
        .doc(edificioId.trim())
        .collection(subcoleccion.trim())
        .doc(docId.trim());

      await docRef.delete();
      invalidateAll();

      res.json({
        ok: true,
        docId,
        message: 'Locación eliminada correctamente de Firestore.',
      });
    } catch (error) {
      next(error);
    }
  }

  // ── 4. GESTIÓN DE RUTAS Y NAVEGACIÓN ──────────────────────────
  async listNavigationData(req, res, next) {
    try {
      const navPathsSnap = await db.collection('NavigationPaths').get().catch(() => ({ docs: [] }));
      const rutasSnap = await db.collection('Rutas').get().catch(() => ({ docs: [] }));

      const navigationPaths = (navPathsSnap.docs || []).map((d) => ({
        id: d.id,
        path: d.ref.path,
        data: d.data(),
      }));

      const rutas = (rutasSnap.docs || []).map((d) => ({
        id: d.id,
        path: d.ref.path,
        data: d.data(),
      }));

      res.json({
        navigationPaths,
        rutas,
      });
    } catch (error) {
      next(error);
    }
  }

  async saveNavigationDocument(req, res, next) {
    try {
      const { collection, docId, data } = req.body;
      if (!['NavigationPaths', 'Rutas'].includes(collection)) {
        return res.status(400).json({ error: 'La colección debe ser "NavigationPaths" o "Rutas".' });
      }
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'El campo "data" debe ser un objeto.' });
      }

      let docRef;
      if (docId && docId.trim()) {
        docRef = db.collection(collection).doc(docId.trim());
        await docRef.set(data, { merge: true });
      } else {
        docRef = await db.collection(collection).add(data);
      }

      invalidateAll();

      res.json({
        ok: true,
        id: docRef.id,
        path: docRef.path,
        message: `Ruta guardada exitosamente en ${collection}.`,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteNavigationDocument(req, res, next) {
    try {
      const { collection, docId } = req.body;
      if (!['NavigationPaths', 'Rutas'].includes(collection)) {
        return res.status(400).json({ error: 'La colección debe ser "NavigationPaths" o "Rutas".' });
      }
      if (!docId || !docId.trim()) {
        return res.status(400).json({ error: 'El campo "docId" es obligatorio.' });
      }

      await db.collection(collection).doc(docId.trim()).delete();
      invalidateAll();

      res.json({
        ok: true,
        id: docId,
        message: `Documento eliminado de ${collection}.`,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FirestoreAdminController();
