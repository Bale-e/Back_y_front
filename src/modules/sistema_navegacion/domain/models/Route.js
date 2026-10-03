/**
 * Entidad de Dominio: Ruta con lista ordenada de pasos y distancia total
 */
class Route {
  constructor({ startNodeId, goalNodeId, nodes = [], totalDistance = 0 }) {
    this.startNodeId = startNodeId;
    this.goalNodeId = goalNodeId;
    this.nodes = nodes;
    this.totalDistance = totalDistance;
  }

  get coordinates() {
    return this.nodes
      .filter((n) => n && n.point3d)
      .map((n) => [n.point3d.x, n.point3d.y, n.point3d.z]);
  }
}

module.exports = Route;
