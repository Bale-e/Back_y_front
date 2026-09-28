const { db } = require('../../../../shared/infrastructure/firebase/firebaseAdmin');
const { withCache } = require('../../../../shared/infrastructure/cache/MemoryCacheAdapter');
const { getFieldCI } = require('../../../gestion_espacios/infrastructure/helpers/firestoreHelpers');
const INavigationRepository = require('../../domain/ports/INavigationRepository');

class FirestoreNavigationRepository extends INavigationRepository {
  async obtenerTodosLosPaths() {
    return withCache('navigationPaths:todos', async () => {
      const snapshot = await db.collection('navigation-paths').get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    });
  }

  normalizeFloorKey(piso) {
    if (!piso) return '';
    const normalized = piso.toString().trim().toLowerCase().replace(/\s+/g, '');
    if (/^\d+$/.test(normalized)) {
      return `piso${normalized}`;
    }
    return normalized;
  }

  async obtenerPathPorPiso(piso) {
    const todos = await this.obtenerTodosLosPaths();
    const pisoBuscado = this.normalizeFloorKey(piso);
    return (
      todos.find((doc) => {
        const p = getFieldCI(doc, 'piso') ?? getFieldCI(doc, 'Piso ') ?? getFieldCI(doc, 'Piso');
        const normalizedDocPiso = this.normalizeFloorKey(p);
        return normalizedDocPiso === pisoBuscado;
      }) || null
    );
  }

  async obtenerRutasAntiguas() {
    return withCache('rutas:todas', async () => {
      const snapshot = await db.collection('rutas').get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    });
  }
}

module.exports = new FirestoreNavigationRepository();
