/**
 * Entidad de Dominio: Edificio
 */
class Edificio {
  constructor({ id, nombre, descripcion, pisos = [], coordenadas = null, raw = {} }) {
    this.id = id;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.pisos = pisos;
    this.coordenadas = coordenadas;
    this.raw = raw;
  }
}

module.exports = Edificio;
