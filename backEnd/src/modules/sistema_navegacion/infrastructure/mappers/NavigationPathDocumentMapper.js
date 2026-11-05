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

  static extractNavPathPoints(doc) {
    const accesos = {};
    const giros = [];
    const conexiones = {};

    if (!doc || typeof doc !== 'object') {
      return { accesos, giros, conexiones };
    }

    // 1. Accesos
    const accesosData = doc.Accesos || doc.accesos;
    if (accesosData && typeof accesosData === 'object') {
      if (Array.isArray(accesosData)) {
        accesosData.forEach((item, index) => {
          const pt = this.extractPoint(item);
          if (pt) accesos[`Acceso${index + 1}`] = pt.toJSON();
        });
      } else {
        Object.entries(accesosData).forEach(([key, val]) => {
          const pt = this.extractPoint(val);
          if (pt) accesos[key] = pt.toJSON();
        });
      }
    }

    // 2. Giros
    const girosData = doc.Giros || doc.giros || doc.Turns || doc.turns;
    if (girosData) {
      const items = Array.isArray(girosData) ? girosData : Object.values(girosData);
      for (const item of items) {
        const pt = this.extractPoint(item);
        if (pt) giros.push(pt.toJSON());
      }
    }

    // Si es un path del Edificio A y solo tiene 1 giro (extremo este en x > 8),
    // asegurar el giro del extremo oeste del pasillo para que cubra todas las salas del piso (A201-A218, A301-A318)
    const isEdificioA = (doc.id || '').includes('EdificioA') || (doc.Edificio || doc.edificio || '').toString().includes('A');
    if (isEdificioA && giros.length === 1 && giros[0].x > 5) {
      const floorY = giros[0].y;
      giros.push({ x: -9.21, y: floorY, z: -0.44 });
    }

    // 3. Conexiones (POIs)
    const conexionesData = doc.Conexiones || doc.conexiones || doc.POIs || doc.pois;
    if (conexionesData && typeof conexionesData === 'object') {
      if (Array.isArray(conexionesData)) {
        conexionesData.forEach((item, index) => {
          const pt = this.extractPoint(item);
          if (pt) conexiones[`Conexion${index + 1}`] = pt.toJSON();
        });
      } else {
        Object.entries(conexionesData).forEach(([key, val]) => {
          const pt = this.extractPoint(val);
          if (pt) conexiones[key] = pt.toJSON();
        });
      }
    }

    // 4. Compatibilidad con documentos con estructura plana de waypoints (Edificios B, C, D)
    if (Object.keys(accesos).length === 0 && giros.length === 0) {
      const excludedKeys = ['id', 'edificio', 'piso', '_coleccion', '_edificioid', '_edificionombre'];
      const flatPoints = [];

      for (const [key, val] of Object.entries(doc)) {
        if (excludedKeys.includes(key.toLowerCase()) || !val || typeof val !== 'object') continue;
        const pt = this.extractPoint(val);
        if (pt) {
          const ptJson = pt.toJSON();
          flatPoints.push({ name: key, point: ptJson });
          if (/entrada|acceso|conector|salida|inicio/i.test(key)) {
            accesos[key] = ptJson;
          } else {
            conexiones[key] = ptJson;
          }
        }
      }

      if (flatPoints.length > 0) {
        if (Object.keys(accesos).length === 0) {
          accesos[flatPoints[0].name] = flatPoints[0].point;
        }

        // Ordenamiento genérico del pasillo según su eje dominante (Z o X)
        const zSpread = Math.max(...flatPoints.map(p => p.point.z)) - Math.min(...flatPoints.map(p => p.point.z));
        const xSpread = Math.max(...flatPoints.map(p => p.point.x)) - Math.min(...flatPoints.map(p => p.point.x));
        if (zSpread >= xSpread) {
          flatPoints.sort((a, b) => b.point.z - a.point.z);
        } else {
          flatPoints.sort((a, b) => a.point.x - b.point.x);
        }

        flatPoints.forEach(fp => giros.push(fp.point));
      }
    }

    return { accesos, giros, conexiones };
  }

  static findDestinationInPaths(paths, destinationName) {
    if (!Array.isArray(paths) || paths.length === 0 || !destinationName) return null;
    const targetLower = destinationName.trim().toLowerCase();

    for (const path of paths) {
      const { accesos, conexiones } = this.extractNavPathPoints(path);

      for (const [name, pos] of Object.entries(conexiones)) {
        if (name.trim().toLowerCase() === targetLower || name.trim().toLowerCase().includes(targetLower)) {
          return { path, pointName: name, position: pos };
        }
      }

      for (const [name, pos] of Object.entries(accesos)) {
        if (name.trim().toLowerCase() === targetLower || name.trim().toLowerCase().includes(targetLower)) {
          return { path, pointName: name, position: pos };
        }
      }
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
