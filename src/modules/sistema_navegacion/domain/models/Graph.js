/**
 * Agregado de Dominio: Grafo Topológico de Navegación
 */
class Graph {
  constructor() {
    this.nodes = new Map(); // id -> Node
    this.adjacencyList = new Map(); // id -> Edge[]
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, []);
    }
  }

  addEdge(edge) {
    if (!this.adjacencyList.has(edge.fromNodeId)) {
      this.adjacencyList.set(edge.fromNodeId, []);
    }
    this.adjacencyList.get(edge.fromNodeId).push(edge);
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getNeighbors(id) {
    return this.adjacencyList.get(id) || [];
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }
}

module.exports = Graph;
