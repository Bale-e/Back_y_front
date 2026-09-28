/**
 * Entidad de Dominio: Piso dentro de un Edificio
 */
class Piso {
  constructor({ id, numero, nombre, modelPath = null, zOffset = 0, locaciones = [] }) {
    this.id = id;
    this.numero = numero;
    this.nombre = nombre || `Piso ${numero}`;
    this.modelPath = modelPath;
    this.zOffset = zOffset;
    this.locaciones = locaciones;
  }
}

module.exports = Piso;
