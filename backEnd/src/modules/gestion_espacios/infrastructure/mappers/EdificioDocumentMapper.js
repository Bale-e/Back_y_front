const Edificio = require('../../domain/models/Edificio');
const { getFieldCI, extraerCoordenadas } = require('../helpers/firestoreHelpers');

class EdificioDocumentMapper {
  static toDomain(doc) {
    if (!doc) return null;
    const nombre = getFieldCI(doc, 'nombre') || getFieldCI(doc, 'Nombre') || 'Edificio';
    const descripcion = getFieldCI(doc, 'descripcion') || '';
    const pisos = getFieldCI(doc, 'pisos') || getFieldCI(doc, 'Pisos') || [];
    const coordenadas = extraerCoordenadas(doc);

    return new Edificio({
      id: doc.id,
      nombre,
      descripcion,
      pisos: Array.isArray(pisos) ? pisos : [pisos],
      coordenadas,
      raw: doc,
    });
  }

  static toResponseDto(edificio) {
    if (!edificio) return null;
    return {
      id: edificio.id,
      nombre: edificio.nombre,
      descripcion: edificio.descripcion,
      pisos: edificio.pisos,
      coordenadas: edificio.coordenadas,
    };
  }
}

module.exports = EdificioDocumentMapper;
