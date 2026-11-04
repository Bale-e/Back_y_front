const { db } = require('../../../../shared/infrastructure/firebase/firebaseAdmin');
const { withCache, invalidate } = require('../../../../shared/infrastructure/cache/MemoryCacheAdapter');
const IEdificioRepository = require('../../domain/ports/IEdificioRepository');
const EdificioDocumentMapper = require('../mappers/EdificioDocumentMapper');

class FirestoreEdificioRepository extends IEdificioRepository {
  async obtenerTodos() {
    return withCache('edificios:todos', async () => {
      const snapshot = await db.collection('Edificios').get();
      return snapshot.docs
        .map((doc) => EdificioDocumentMapper.toDomain({ id: doc.id, ...doc.data() }))
        .filter(Boolean);
    });
  }

  async obtenerPorId(id) {
    const todos = await this.obtenerTodos();
    return todos.find((e) => e.id === id) || null;
  }

  async obtenerPorNombre(nombre) {
    if (!nombre) return null;
    const todos = await this.obtenerTodos();
    const nombreBuscado = nombre.trim().toLowerCase();
    return (
      todos.find((e) => (e.nombre || '').trim().toLowerCase() === nombreBuscado) || null
    );
  }

  async crear(datos) {
    const docRef = await db.collection('Edificios').add(datos);
    invalidate('edificios:todos');
    return EdificioDocumentMapper.toDomain({ id: docRef.id, ...datos });
  }

  async actualizar(id, datos) {
    await db.collection('Edificios').doc(id).set(datos, { merge: true });
    invalidate('edificios:todos');
    return EdificioDocumentMapper.toDomain({ id, ...datos });
  }

  async eliminar(id) {
    await db.collection('Edificios').doc(id).delete();
    invalidate('edificios:todos');
    return { id, eliminado: true };
  }
}

module.exports = new FirestoreEdificioRepository();
