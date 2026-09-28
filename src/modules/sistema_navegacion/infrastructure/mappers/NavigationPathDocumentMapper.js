const Node = require('../../domain/models/Node');
const Edge = require('../../domain/models/Edge');
const Graph = require('../../domain/models/Graph');
const Point3D = require('../../../../shared/domain/value-objects/Point3D');
const { getFieldCI } = require('../../../gestion_espacios/infrastructure/helpers/firestoreHelpers');

class NavigationPathDocumentMapper {
  static extractPoint(obj) {
    if (!obj) return null;
    if (Array.isArray(obj) && obj.length >= 3) {
      return Point3D.create(obj[0], obj[1], obj[2]);
    }
    if (typeof obj === 'object') {
      const src = obj.Coordenadas3D || obj['Coordenadas 3D'] || obj.Coordenadas || obj.coordenadas || obj;
      const getVal = (f) => {
        const k = Object.keys(src || {}).find((key) => key.toLowerCase() === f.toLowerCase());
        return k !== undefined ? Number(src[k]) : NaN;
      };
      return Point3D.create(getVal('x'), getVal('y'), getVal('z'));
    }
    return null;
  }

  static toGraph(navigationPathDocs) {
    const graph = new Graph();
    if (!Array.isArray(navigationPathDocs)) return graph;

    for (const doc of navigationPathDocs) {
      const piso = getFieldCI(doc, 'piso') || getFieldCI(doc, 'Piso') || 'Piso 1';
      const edificio = getFieldCI(doc, 'edificio') || getFieldCI(doc, 'Edificio') || 'A';
      const pathId = doc.id;

      const accesos = doc.Accesos || doc.accesos || {};
      const giros = doc.Giros || doc.giros || doc.Turns || doc.turns || [];
      const conexiones = doc.Conexiones || doc.conexiones || doc.POIs || doc.pois || {};

      const pathNodes = [];

      // 1. Mapear Accesos
      if (Array.isArray(accesos)) {
        accesos.forEach((item, idx) => {
          const pt = this.extractPoint(item);
          if (pt) {
            const nodeId = `${pathId}_acc_${idx + 1}`;
            const node = new Node({ id: nodeId, name: `Acceso${idx + 1}`, type: 'acceso', point3d: pt, piso, edificio, pathId });
            graph.addNode(node);
            pathNodes.push(node);
          }
        });
      } else if (typeof accesos === 'object') {
        Object.entries(accesos).forEach(([key, val]) => {
          const pt = this.extractPoint(val);
          if (pt) {
            const nodeId = `${pathId}_acc_${key}`;
            const node = new Node({ id: nodeId, name: key, type: 'acceso', point3d: pt, piso, edificio, pathId });
            graph.addNode(node);
            pathNodes.push(node);
          }
        });
      }

      // 2. Mapear Giros
      const giroList = Array.isArray(giros) ? giros : Object.values(giros);
      giroList.forEach((item, idx) => {
        const pt = this.extractPoint(item);
        if (pt) {
          const nodeId = `${pathId}_giro_${idx + 1}`;
          const node = new Node({ id: nodeId, name: `Giro${idx + 1}`, type: 'giro', point3d: pt, piso, edificio, pathId });
          graph.addNode(node);
          pathNodes.push(node);
        }
      });

      // 3. Mapear Conexiones (POIs)
      if (Array.isArray(conexiones)) {
        conexiones.forEach((item, idx) => {
          const pt = this.extractPoint(item);
          if (pt) {
            const nodeId = `${pathId}_poi_${idx + 1}`;
            const node = new Node({ id: nodeId, name: `Conexion${idx + 1}`, type: 'poi', point3d: pt, piso, edificio, pathId });
            graph.addNode(node);
            pathNodes.push(node);
          }
        });
      } else if (typeof conexiones === 'object') {
        Object.entries(conexiones).forEach(([key, val]) => {
          const pt = this.extractPoint(val);
          if (pt) {
            const nodeId = `${pathId}_poi_${key}`;
            const node = new Node({ id: nodeId, name: key, type: 'poi', point3d: pt, piso, edificio, pathId });
            graph.addNode(node);
            pathNodes.push(node);
          }
        });
      }

      // 4. Conectar secuencialmente los nodos del path
      for (let i = 0; i < pathNodes.length - 1; i++) {
        const u = pathNodes[i];
        const v = pathNodes[i + 1];
        const dist = u.point3d && v.point3d ? u.point3d.distanceTo(v.point3d) : 1;
        graph.addEdge(new Edge({ fromNodeId: u.id, toNodeId: v.id, weight: dist }));
        graph.addEdge(new Edge({ fromNodeId: v.id, toNodeId: u.id, weight: dist }));
      }
    }

    return graph;
  }
}

module.exports = NavigationPathDocumentMapper;
