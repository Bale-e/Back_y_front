/**
 * Entidad de Dominio: Nodo en el grafo de navegación
 */
class Node {
  constructor({ id, name, type = 'waypoint', point3d = null, piso = 'Piso 1', edificio = 'A', pathId = null, metadata = {} }) {
    this.id = id;
    this.name = name;
    this.type = type; // 'acceso', 'giro', 'poi', 'waypoint'
    this.point3d = point3d;
    this.piso = piso;
    this.edificio = edificio;
    this.pathId = pathId;
    this.metadata = metadata;
  }
}

module.exports = Node;
