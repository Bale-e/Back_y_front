const navigationRepository = require('../../infrastructure/repositories/FirestoreNavigationRepository');
const locacionRepository = require('../../../gestion_espacios/infrastructure/repositories/FirestoreLocacionRepository');
const ICalcularRutaUseCase = require('../ports/ICalcularRutaUseCase');
const RutaCalculadaResponseDto = require('../dtos/RutaCalculadaResponse.dto');
const NavigationPathDocumentMapper = require('../../infrastructure/mappers/NavigationPathDocumentMapper');
const aStarAlgorithm = require('../../domain/services/AStarAlgorithm');
const { getFieldCI } = require('../../../gestion_espacios/infrastructure/helpers/firestoreHelpers');
const Point3D = require('../../../../shared/domain/value-objects/Point3D');

function extractVec3Point(obj) {
  if (!obj) return null;
  if (Array.isArray(obj) && obj.length >= 3) {
    const x = Number(obj[0]);
    const y = Number(obj[1]);
    const z = Number(obj[2]);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      return { x, y, z };
    }
  }

  if (typeof obj === 'object') {
    const src = obj.Coordenadas3D || obj['Coordenadas 3D'] || obj.Coordenadas || obj.coordenadas || obj;
    const getVal = (field) => {
      const key = Object.keys(src || {}).find((k) => k.toLowerCase() === field.toLowerCase());
      return key !== undefined ? Number(src[key]) : NaN;
    };

    const x = getVal('x');
    const y = getVal('y');
    const z = getVal('z');

    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      return { x, y, z };
    }
  }

  return null;
}

function extractNavPathPoints(doc) {
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
        const v = extractVec3Point(item);
        if (v) accesos[`Acceso${index + 1}`] = v;
      });
    } else {
      Object.entries(accesosData).forEach(([key, val]) => {
        const v = extractVec3Point(val);
        if (v) accesos[key] = v;
      });
    }
  }

  // 2. Giros
  const girosData = doc.Giros || doc.giros || doc.Turns || doc.turns;
  if (girosData) {
    const items = Array.isArray(girosData) ? girosData : Object.values(girosData);
    for (const item of items) {
      const v = extractVec3Point(item);
      if (v) giros.push(v);
    }
  }

  // 3. Conexiones (POIs)
  const conexionesData = doc.Conexiones || doc.conexiones || doc.POIs || doc.pois;
  if (conexionesData && typeof conexionesData === 'object') {
    if (Array.isArray(conexionesData)) {
      conexionesData.forEach((item, index) => {
        const v = extractVec3Point(item);
        if (v) conexiones[`Conexion${index + 1}`] = v;
      });
    } else {
      Object.entries(conexionesData).forEach(([key, val]) => {
        const v = extractVec3Point(val);
        if (v) conexiones[key] = v;
      });
    }
  }

  return { accesos, giros, conexiones };
}

function findDestinationInPaths(paths, destinationName) {
  if (!Array.isArray(paths) || paths.length === 0 || !destinationName) return null;
  const targetLower = destinationName.trim().toLowerCase();

  for (const path of paths) {
    const { accesos, conexiones } = extractNavPathPoints(path);

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

function cleanDuplicatePoints(points, thresholdSq = 0.0001) {
  const result = [];
  for (const pt of points) {
    if (result.length === 0) {
      result.push(pt);
    } else {
      const prev = result[result.length - 1];
      const dx = prev.x - pt.x;
      const dy = prev.y - pt.y;
      const dz = prev.z - pt.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > thresholdSq) {
        result.push(pt);
      }
    }
  }
  return result;
}

class CalcularRutaUseCase extends ICalcularRutaUseCase {
  constructor(navRepo = navigationRepository, locRepo = locacionRepository, pathfinder = aStarAlgorithm) {
    super();
    this.navRepo = navRepo;
    this.locRepo = locRepo;
    this.pathfinder = pathfinder;
  }

  async execute({ origen, destino, piso = null, edificio = null, preferencias = {} }) {
    const res = await this.executeRutaHaciaDestino(destino, { startName: origen, piso, edificio });
    if (!res) return null;

    return new RutaCalculadaResponseDto({
      startName: res.startName,
      endName: res.endName,
      startPathId: res.startPathId,
      endPathId: res.endPathId,
      coordinates: res.coordinates,
      distance: res.distance || 0,
      steps: res.steps || [],
    });
  }

  async executeRutaHaciaDestino(destino, options = {}) {
    const startName = options.startName || 'MainEntrance';
    const allPaths = await this.navRepo.obtenerTodosLosPaths();

    // 1. Filtrar paths por edificio / piso si se especifica en options
    let filteredPaths = allPaths;
    if (options.edificio || options.piso) {
      filteredPaths = allPaths.filter((path) => {
        if (options.piso) {
          const p = (getFieldCI(path, 'piso') || '').toString().trim().toLowerCase();
          const targetP = options.piso.toString().trim().toLowerCase();
          if (p && targetP && !p.includes(targetP) && !targetP.includes(p)) return false;
        }
        if (options.edificio) {
          const ed = (getFieldCI(path, 'edificio') || '').toString().trim().toLowerCase();
          const targetEd = options.edificio.toString().trim().toLowerCase();
          if (ed && targetEd && !ed.includes(targetEd) && !targetEd.includes(ed)) return false;
        }
        return true;
      });
    }
    const pathsToUse = filteredPaths.length > 0 ? filteredPaths : allPaths;

    // 2. Buscar destino en los navigation-paths
    const destMatch = findDestinationInPaths(pathsToUse, destino);
    let destPos = destMatch ? destMatch.position : null;
    let endPath = destMatch ? destMatch.path : pathsToUse[0];

    // Fallback: si no está en navigation-paths directamente, buscar coordenadas en Locaciones
    if (!destPos) {
      const loc = await this.locRepo.buscarGlobalPorNombre(destino);
      if (loc && loc.coordenadas) {
        destPos = loc.coordenadas;
      }
    }

    if (!destPos) {
      return null;
    }

    // 3. Identificar path de inicio y punto de acceso inicial
    let startPath = pathsToUse[0];
    let startPos = null;
    let selectedStartName = startName;

    if (startName) {
      for (const path of pathsToUse) {
        const { accesos } = extractNavPathPoints(path);
        const acc = Object.entries(accesos).find(
          ([k]) => k.trim().toLowerCase() === startName.trim().toLowerCase()
        );
        if (acc) {
          startPath = path;
          startPos = acc[1];
          selectedStartName = acc[0];
          break;
        }
      }
    }

    if (!startPos) {
      const { accesos: startAccesos } = extractNavPathPoints(startPath);
      const firstAccKey = Object.keys(startAccesos)[0];
      if (firstAccKey) {
        startPos = startAccesos[firstAccKey];
        selectedStartName = firstAccKey;
      } else {
        for (const p of pathsToUse) {
          const { accesos } = extractNavPathPoints(p);
          const k = Object.keys(accesos)[0];
          if (k) {
            startPath = p;
            startPos = accesos[k];
            selectedStartName = k;
            break;
          }
        }
      }
    }

    if (!startPos) {
      startPos = destPos;
    }

    // 4. Trazar ruta
    const rawRoute = [{ ...startPos }];

    if (startPath === endPath) {
      const { giros } = extractNavPathPoints(startPath);
      giros.forEach((g) => rawRoute.push({ ...g }));
      rawRoute.push({ ...destPos });
    } else {
      const { giros: startGiros, accesos: startAccesos } = extractNavPathPoints(startPath);
      const { giros: endGiros, accesos: endAccesos } = extractNavPathPoints(endPath);

      startGiros.forEach((g) => rawRoute.push({ ...g }));

      let commonAcc = null;
      for (const keyA of Object.keys(startAccesos)) {
        if (keyA in endAccesos) {
          commonAcc = startAccesos[keyA];
          break;
        }
      }

      if (commonAcc) {
        rawRoute.push({ ...commonAcc });
      } else {
        const firstEndAcc = Object.values(endAccesos)[0];
        if (firstEndAcc) rawRoute.push({ ...firstEndAcc });
      }

      endGiros.forEach((g) => rawRoute.push({ ...g }));
      rawRoute.push({ ...destPos });
    }

    const cleaned = cleanDuplicatePoints(rawRoute);

    let totalDist = 0;
    for (let i = 0; i < cleaned.length - 1; i++) {
      const dx = cleaned[i + 1].x - cleaned[i].x;
      const dy = cleaned[i + 1].y - cleaned[i].y;
      const dz = cleaned[i + 1].z - cleaned[i].z;
      totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    return {
      startName: selectedStartName,
      endName: destino,
      startPathId: startPath?.id || null,
      endPathId: endPath?.id || startPath?.id || null,
      coordinates: cleaned.map((p) => [p.x, p.y, p.z]),
      distance: Number(totalDist.toFixed(2)),
    };
  }
}

module.exports = new CalcularRutaUseCase();
