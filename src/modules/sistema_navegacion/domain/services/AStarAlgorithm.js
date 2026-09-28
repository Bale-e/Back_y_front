const Route = require('../models/Route');

/**
 * Servicio de Dominio: Algoritmo de Búsqueda de Camino Óptimo A* (A-Star)
 */
class AStarAlgorithm {
  /**
   * Calcula la ruta óptima entre dos nodos en un grafo topológico multi-piso.
   * @param {import('../models/Graph')} graph
   * @param {string} startNodeId
   * @param {string} goalNodeId
   * @returns {import('../models/Route')|null}
   */
  findPath(graph, startNodeId, goalNodeId) {
    if (!graph || !startNodeId || !goalNodeId) return null;
    const startNode = graph.getNode(startNodeId);
    const goalNode = graph.getNode(goalNodeId);
    if (!startNode || !goalNode) return null;

    if (startNodeId === goalNodeId) {
      return new Route({
        startNodeId,
        goalNodeId,
        nodes: [startNode],
        totalDistance: 0,
      });
    }

    const heuristic = (nodeA, nodeB) => {
      if (!nodeA?.point3d || !nodeB?.point3d) return 0;
      return nodeA.point3d.distanceTo(nodeB.point3d);
    };

    const openSet = new Set([startNodeId]);
    const cameFrom = new Map();

    const gScore = new Map();
    gScore.set(startNodeId, 0);

    const fScore = new Map();
    fScore.set(startNodeId, heuristic(startNode, goalNode));

    while (openSet.size > 0) {
      let currentId = null;
      let lowestF = Infinity;
      for (const id of openSet) {
        const score = fScore.get(id) ?? Infinity;
        if (score < lowestF) {
          lowestF = score;
          currentId = id;
        }
      }

      if (currentId === goalNodeId) {
        const pathNodes = [goalNode];
        let curr = currentId;
        while (cameFrom.has(curr)) {
          curr = cameFrom.get(curr);
          const n = graph.getNode(curr);
          if (n) pathNodes.unshift(n);
        }

        const totalDist = gScore.get(goalNodeId) || 0;
        return new Route({
          startNodeId,
          goalNodeId,
          nodes: pathNodes,
          totalDistance: Number(totalDist.toFixed(2)),
        });
      }

      openSet.delete(currentId);
      const neighbors = graph.getNeighbors(currentId);

      for (const edge of neighbors) {
        const neighborId = edge.toNodeId;
        const neighborNode = graph.getNode(neighborId);
        if (!neighborNode) continue;

        const tentativeG = (gScore.get(currentId) ?? Infinity) + edge.weight;

        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, currentId);
          gScore.set(neighborId, tentativeG);
          const f = tentativeG + heuristic(neighborNode, goalNode);
          fScore.set(neighborId, f);
          openSet.add(neighborId);
        }
      }
    }

    return null;
  }
}

module.exports = new AStarAlgorithm();
