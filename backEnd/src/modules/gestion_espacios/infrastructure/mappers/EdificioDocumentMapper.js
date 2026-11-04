const Edificio = require('../../domain/models/Edificio');
const { getFieldCI, extraerCoordenadas } = require('../helpers/firestoreHelpers');

class EdificioDocumentMapper {
  static toDomain(doc) {
    if (!doc) return null;
    const nombre = getFieldCI(doc, 'nombre') || getFieldCI(doc, 'Nombre') || 'Edificio';
    const descripcion = getFieldCI(doc, 'descripcion') || '';
    const pisos = getFieldCI(doc, 'pisos') || getFieldCI(doc, 'Pisos') || [];
    const coordenadas = extraerCoordenadas(doc);
    const cuerpo = getFieldCI(doc, 'cuerpo') || getFieldCI(doc, 'Cuerpo') || null;

    return new Edificio({
      id: doc.id,
      nombre,
      descripcion,
      pisos: Array.isArray(pisos) ? pisos : [pisos],
      coordenadas,
      cuerpo,
      raw: doc,
    });
  }

  static toResponseDto(edificio) {
    if (!edificio) return null;
    const raw = edificio.raw || {};
    return {
      ...raw,
      id: edificio.id,
      nombre: edificio.nombre,
      Nombre: edificio.nombre,
      descripcion: edificio.descripcion,
      pisos: edificio.pisos,
      Pisos: edificio.pisos,
      coordenadas: edificio.coordenadas,
      'Coordenadas 3D': edificio.coordenadas || raw['Coordenadas 3D'],
      cuerpo: edificio.cuerpo ?? raw.cuerpo ?? null,
    };
  }
}

module.exports = EdificioDocumentMapper;
