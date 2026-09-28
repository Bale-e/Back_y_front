/**
 * Entidad de Dominio: Locacion (Punto de Interés dentro de un Edificio)
 */
class Locacion {
  constructor({ id, nombre, tipo, piso, cuerpo = null, coordenadas = null, edificioId = null, edificioNombre = null, raw = {} }) {
    this.id = id;
    this.nombre = nombre;
    this.tipo = tipo;
    this.piso = piso;
    this.cuerpo = cuerpo;
    this.coordenadas = coordenadas;
    this.edificioId = edificioId;
    this.edificioNombre = edificioNombre;
    this.raw = raw;
  }
}

module.exports = Locacion;
