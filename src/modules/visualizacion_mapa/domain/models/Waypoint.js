/**
 * Entidad de Dominio: Waypoint (Punto en el mapa de renderizado)
 */
class Waypoint {
  constructor({ id, point3d, piso, orden = 0, type = 'waypoint', metadata = {} }) {
    this.id = id;
    this.point3d = point3d;
    this.piso = piso;
    this.orden = orden;
    this.type = type;
    this.metadata = metadata;
  }
}

module.exports = Waypoint;
