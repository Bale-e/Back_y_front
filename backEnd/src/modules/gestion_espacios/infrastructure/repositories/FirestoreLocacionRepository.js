const { withCache } = require('../../../../shared/infrastructure/cache/MemoryCacheAdapter');
const { getFieldCI, extraerCoordenadas, obtenerLocacionesDeEdificio } = require('../helpers/firestoreHelpers');
const defaultEdificioRepository = require('./FirestoreEdificioRepository');
const ILocacionRepository = require('../../domain/ports/ILocacionRepository');
const LocacionDocumentMapper = require('../mappers/LocacionDocumentMapper');

class FirestoreLocacionRepository extends ILocacionRepository {
  constructor(edificioRepository = defaultEdificioRepository) {
    super();
    this.edificioRepo = edificioRepository;
  }

  async obtenerPorEdificio(edificioId) {
    const rawList = await obtenerLocacionesDeEdificio(edificioId);
    return rawList
      .map((item) => LocacionDocumentMapper.toDomain({ ...item, _edificioId: edificioId }))
      .filter(Boolean);
  }

  async obtenerPorEdificioYPiso(edificioId, piso) {
    const todas = await this.obtenerPorEdificio(edificioId);
    const pisoBuscado = (piso || '').trim().toLowerCase();
    return todas.filter((loc) => {
      const p = (loc.piso || '').toString().trim().toLowerCase();
      return p === pisoBuscado || p.includes(pisoBuscado);
    });
  }

  async obtenerPorEdificioYTipo(edificioId, tipo) {
    const todas = await this.obtenerPorEdificio(edificioId);
    const tipoBuscado = (tipo || '').trim().toLowerCase();
    return todas.filter((loc) => {
      const t = (loc.tipo || '').toString().trim().toLowerCase();
      return t === tipoBuscado || t.includes(tipoBuscado);
    });
  }

  async obtenerPorNombreEnEdificio(edificioId, nombre) {
    const todas = await this.obtenerPorEdificio(edificioId);
    const nombreBuscado = (nombre || '').trim().toLowerCase();
    return (
      todas.find((loc) => (loc.nombre || '').toString().trim().toLowerCase() === nombreBuscado) ||
      null
    );
  }

  async obtenerTodasLasLocaciones() {
    return withCache('locaciones:todas_globales', async () => {
      const edificios = await this.edificioRepo.obtenerTodos();
      const buildingResults = await Promise.all(
        edificios.map(async (edificio) => {
          const rawLocs = await obtenerLocacionesDeEdificio(edificio.id);
          const nombreEdificio = edificio.nombre || 'Edificio sin nombre';
          return rawLocs.map((loc) =>
            LocacionDocumentMapper.toDomain({
              ...loc,
              _edificioId: edificio.id,
              _edificioNombre: nombreEdificio,
            })
          );
        })
      );
      return buildingResults.flat().filter(Boolean);
    });
  }

  async buscarGlobalPorNombre(nombre) {
    if (!nombre || typeof nombre !== 'string') return null;
    const todas = await this.obtenerTodasLasLocaciones();
    const nombreBuscado = nombre.trim().toLowerCase();
    return (
      todas.find((loc) => (loc.nombre || '').toString().trim().toLowerCase() === nombreBuscado) ||
      null
    );
  }

  async buscarGlobalPorPiso(piso) {
    const todas = await this.obtenerTodasLasLocaciones();
    const pisoRaw = (piso || '').trim().toLowerCase();
    const pisoDigitos = pisoRaw.replace(/[^0-9-]/g, '');

    return todas.filter((loc) => {
      const p = (loc.piso || '').toString().trim().toLowerCase();
      const pDigitos = p.replace(/[^0-9-]/g, '');
      if (p === pisoRaw || (pisoDigitos && pDigitos === pisoDigitos)) return true;
      if (p.includes(`piso ${pisoRaw}`) || p.includes(`piso${pisoRaw}`)) return true;
      return false;
    });
  }

  async buscarGlobalPorTipo(tipo) {
    const todas = await this.obtenerTodasLasLocaciones();
    const tipoBuscado = (tipo || '').trim().toLowerCase();

    return todas.filter((loc) => {
      const t = (loc.tipo || '').toString().trim().toLowerCase();
      return t === tipoBuscado || t.includes(tipoBuscado);
    });
  }

  async buscarGlobalPorCuerpo(cuerpo) {
    const todas = await this.obtenerTodasLasLocaciones();
    const cuerpoStr = (cuerpo || '').toString().trim().toLowerCase().replace(/^cuerpo\s*/i, '');
    const cuerpoNum = parseInt(cuerpoStr, 10);

    return (
      todas.find((loc) => {
        const c = loc.cuerpo;
        if (c == null) return false;
        const cVal = c.toString().trim().toLowerCase().replace(/^cuerpo\s*/i, '');
        if (cVal === cuerpoStr) return true;
        if (!isNaN(cuerpoNum) && parseInt(cVal, 10) === cuerpoNum) return true;
        return false;
      }) || null
    );
  }
}

module.exports = new FirestoreLocacionRepository();
