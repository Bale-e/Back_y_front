const { db } = require('../../../../shared/infrastructure/firebase/firebaseAdmin');
const { withCache } = require('../../../../shared/infrastructure/cache/MemoryCacheAdapter');

// ── Colecciones de locaciones dentro de cada edificio ────────
const COLECCIONES_LOCACIONES = [
  'Locaciones',
  'Locaciones piso -1',
  'Locaciones piso 2',
  'Locaciones piso 3',
];

// ── Busca un campo sin importar mayúscula/minúscula ──────────
function getFieldCI(obj, fieldName) {
  if (!obj) return undefined;
  const regex = new RegExp(`^${fieldName}$`, 'i');
  const key = Object.keys(obj).find((k) => regex.test(k));
  return key !== undefined ? obj[key] : undefined;
}

// ── Normaliza coordenadas 3D sin importar el nombre del campo ─
function extraerCoordenadas(doc) {
  const coord = getFieldCI(doc, 'Coordenadas 3D') || getFieldCI(doc, 'Coordenadas') || getFieldCI(doc, 'coordenadas');
  if (!coord || typeof coord !== 'object') return null;
  const x = getFieldCI(coord, 'x');
  const y = getFieldCI(coord, 'y');
  const z = getFieldCI(coord, 'z');
  if (x == null || y == null || z == null) return null;
  return { x: Number(x), y: Number(y), z: Number(z) };
}

// ── Trae todas las locaciones (de las colecciones) de un edificio ─
async function obtenerLocacionesDeEdificio(edificioId) {
  return withCache(`locaciones:${edificioId}`, async () => {
    const snapshots = await Promise.all(
      COLECCIONES_LOCACIONES.map((nombreColeccion) =>
        db
          .collection('Edificios')
          .doc(edificioId)
          .collection(nombreColeccion)
          .get()
          .catch(() => ({ docs: [] }))
      )
    );

    const resultados = [];
    snapshots.forEach((snapshot, idx) => {
      const nombreColeccion = COLECCIONES_LOCACIONES[idx];
      if (snapshot && snapshot.docs) {
        snapshot.docs.forEach((doc) => {
          resultados.push({ id: doc.id, _coleccion: nombreColeccion, ...doc.data() });
        });
      }
    });
    return resultados;
  });
}

module.exports = {
  COLECCIONES_LOCACIONES,
  getFieldCI,
  extraerCoordenadas,
  obtenerLocacionesDeEdificio,
};
