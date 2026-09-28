const { db } = require('../../../../shared/infrastructure/firebase/firebaseAdmin');
const { withCache } = require('../../../../shared/infrastructure/cache/MemoryCacheAdapter');
const { getFieldCI, extraerCoordenadas, obtenerLocacionesDeEdificio } = require('../helpers/firestoreHelpers');
const edificioRepository = require('./FirestoreEdificioRepository');
const ILocacionRepository = require('../../domain/ports/ILocacionRepository');

class FirestoreLocacionRepository extends ILocacionRepository {
  async obtenerPorEdificio(edificioId) {
    return obtenerLocacionesDeEdificio(edificioId);
  }

  async obtenerPorEdificioYPiso(edificioId, piso) {
    const todas = await this.obtenerPorEdificio(edificioId);
    const pisoBuscado = piso.trim().toLowerCase();
    return todas.filter((loc) => {
      const p = getFieldCI(loc, 'piso');
      return (p ?? '').toString().trim().toLowerCase() === pisoBuscado;
    });
  }

  async obtenerPorEdificioYTipo(edificioId, tipo) {
    const todas = await this.obtenerPorEdificio(edificioId);
    const tipoBuscado = tipo.trim().toLowerCase();
    return todas.filter((loc) => {
      const t = getFieldCI(loc, 'tipo');
      return (t ?? '').toString().trim().toLowerCase() === tipoBuscado;
    });
  }

  async obtenerPorNombreEnEdificio(edificioId, nombre) {
    const todas = await this.obtenerPorEdificio(edificioId);
    const nombreBuscado = nombre.trim().toLowerCase();
    const encontrada = todas.find((loc) => {
      const n = getFieldCI(loc, 'nombre');
      return (n ?? '').toString().trim().toLowerCase() === nombreBuscado;
    });
    if (!encontrada) return null;
    return { ...encontrada, coordenadas: extraerCoordenadas(encontrada) };
  }

  async obtenerTodasLasLocaciones() {
    return withCache('locaciones:todas_globales', async () => {
      const edificios = await edificioRepository.obtenerTodos();
      const buildingResults = await Promise.all(
        edificios.map(async (edificio) => {
          const locaciones = await this.obtenerPorEdificio(edificio.id);
          const nombreEdificio = getFieldCI(edificio, 'nombre') ?? 'Edificio sin nombre';
          return locaciones.map((loc) => ({
            ...loc,
            _edificioId: edificio.id,
            _edificioNombre: nombreEdificio,
            coordenadas: extraerCoordenadas(loc),
          }));
        })
      );
      return buildingResults.flat();
    });
  }

  async buscarGlobalPorNombre(nombre) {
    if (!nombre || typeof nombre !== 'string') return null;
    const todas = await this.obtenerTodasLasLocaciones();
    const nombreBuscado = nombre.trim().toLowerCase();
    const encontrada = todas.find((loc) => {
      const n = getFieldCI(loc, 'nombre');
      return (n ?? '').toString().trim().toLowerCase() === nombreBuscado;
    });
    return encontrada || null;
  }

  async buscarGlobalPorPiso(piso) {
    const todas = await this.obtenerTodasLasLocaciones();
    const pisoRaw = piso.trim().toLowerCase();
    const pisoDigitos = pisoRaw.replace(/[^0-9-]/g, '');

    return todas.filter((loc) => {
      const p = (getFieldCI(loc, 'piso') ?? loc._coleccion ?? '').toString().trim().toLowerCase();
      const pDigitos = p.replace(/[^0-9-]/g, '');
      if (p === pisoRaw || (pisoDigitos && pDigitos === pisoDigitos)) return true;
      if (p.includes(`piso ${pisoRaw}`) || p.includes(`piso${pisoRaw}`)) return true;
      return false;
    });
  }

  async buscarGlobalPorTipo(tipo) {
    const todas = await this.obtenerTodasLasLocaciones();
    const tipoBuscado = tipo.trim().toLowerCase();

    return todas.filter((loc) => {
      const t = (getFieldCI(loc, 'tipo') ?? '').toString().trim().toLowerCase();
      return t === tipoBuscado || t.includes(tipoBuscado);
    });
  }

  async buscarGlobalPorCuerpo(cuerpo) {
    const todas = await this.obtenerTodasLasLocaciones();
    const cuerpoStr = cuerpo.toString().trim().toLowerCase().replace(/^cuerpo\s*/i, '');
    const cuerpoNum = parseInt(cuerpoStr, 10);

    const encontrada = todas.find((loc) => {
      const c = getFieldCI(loc, 'cuerpo');
      if (c == null) return false;
      const cVal = c.toString().trim().toLowerCase().replace(/^cuerpo\s*/i, '');
      if (cVal === cuerpoStr) return true;
      if (!isNaN(cuerpoNum) && parseInt(cVal, 10) === cuerpoNum) return true;
      return false;
    });

    return encontrada || null;
  }
}

module.exports = new FirestoreLocacionRepository();
