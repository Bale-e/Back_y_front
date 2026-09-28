const Locacion = require('../../domain/models/Locacion');
const { getFieldCI, extraerCoordenadas } = require('../helpers/firestoreHelpers');

class LocacionDocumentMapper {
  static toDomain(doc) {
    if (!doc) return null;
    const nombre = getFieldCI(doc, 'nombre') || getFieldCI(doc, 'Nombre') || 'Locación';
    const tipo = getFieldCI(doc, 'tipo') || getFieldCI(doc, 'Tipo') || getFieldCI(doc, 'TIpo') || 'Espacio';
    const piso = getFieldCI(doc, 'piso') || getFieldCI(doc, 'Piso') || getFieldCI(doc, 'Piso ') || doc._coleccion || 'Piso 1';
    const cuerpo = getFieldCI(doc, 'cuerpo') || getFieldCI(doc, 'Cuerpo') || null;
    const coordenadas = extraerCoordenadas(doc);

    return new Locacion({
      id: doc.id,
      nombre,
      tipo,
      piso,
      cuerpo,
      coordenadas,
      edificioId: doc._edificioId || null,
      edificioNombre: doc._edificioNombre || null,
      raw: doc,
    });
  }

  static toResponseDto(locacion) {
    if (!locacion) return null;
    return {
      id: locacion.id,
      nombre: locacion.nombre,
      tipo: locacion.tipo,
      piso: locacion.piso,
      cuerpo: locacion.cuerpo,
      coordenadas: locacion.coordenadas,
      edificioId: locacion.edificioId,
      edificioNombre: locacion.edificioNombre,
    };
  }
}

module.exports = LocacionDocumentMapper;
