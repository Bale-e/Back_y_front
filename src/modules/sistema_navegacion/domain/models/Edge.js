/**
 * Value Object / Entidad: Arista conectora entre dos nodos con peso/distancia
 */
class Edge {
  constructor({ fromNodeId, toNodeId, weight = 1, accessible = true }) {
    this.fromNodeId = fromNodeId;
    this.toNodeId = toNodeId;
    this.weight = weight;
    this.accessible = accessible;
  }
}

module.exports = Edge;
