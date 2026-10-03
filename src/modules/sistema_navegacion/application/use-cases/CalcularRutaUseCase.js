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

/**
 * Calcula el punto exacto de inflexión en 90° sobre el camino del pasillo.
 *
 * Para cada segmento del camino (startPos → G0 → G1 → … → Gn), proyecta
 * el destino perpendicularmente sobre el segmento. El segmento con menor
 * distancia perpendicular es el tramo del pasillo que corre al lado de la sala.
 * El punto de inflexión es la proyección interpolada sobre ese segmento
 * (no necesariamente un giro existente), lo que garantiza el giro exacto en
 * 90° sin importar dónde estén los giros del pasillo.
 *
 * @param {object}   startPos - Punto de inicio del camino {x,y,z}
 * @param {object[]} giros    - Array ordenado de giros del pasillo
 * @param {object}   destPos  - Posición del destino {x,y,z}
 * @returns {{ turnPoint: object, girosToInclude: number }}
 *   turnPoint      – punto exacto en el pasillo desde el que se gira al destino
 *   girosToInclude – cuántos giros incluir antes del turnPoint (slice(0, N))
 */
function findTurnPointOnPath(startPos, giros, destPos) {
  if (!giros || giros.length === 0) {
    return { turnPoint: { ...destPos }, girosToInclude: 0 };
  }

  // pathPoints = [startPos, giros[0], giros[1], ..., giros[n-1]]
  const pathPoints = [startPos, ...giros];
  let bestSegIdx = 0;
  let bestT = 0;
  let bestDist = Infinity;

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const A = pathPoints[i];
    const B = pathPoints[i + 1];

    const abx = B.x - A.x, aby = B.y - A.y, abz = B.z - A.z;
    const abLen2 = abx * abx + aby * aby + abz * abz;

    let t = 0;
    let dist;

    if (abLen2 < 1e-10) {
      // Segmento degenerado: distancia al punto A
      const dx = destPos.x - A.x, dy = destPos.y - A.y, dz = destPos.z - A.z;
      dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    } else {
      // Proyección del destino sobre el segmento AB, clampada en [0,1]
      const adx = destPos.x - A.x, ady = destPos.y - A.y, adz = destPos.z - A.z;
      t = Math.max(0, Math.min(1, (adx * abx + ady * aby + adz * abz) / abLen2));
      const cx = A.x + t * abx, cy = A.y + t * aby, cz = A.z + t * abz;
      const dx = destPos.x - cx, dy = destPos.y - cy, dz = destPos.z - cz;
      dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    if (dist < bestDist) {
      bestDist = dist;
      bestSegIdx = i;
      bestT = t;
    }
  }

  // Interpolar el punto exacto de inflexión sobre el segmento más cercano
  const A = pathPoints[bestSegIdx];
  const B = pathPoints[bestSegIdx + 1];
  const turnPoint = {
    x: A.x + bestT * (B.x - A.x),
    y: A.y + bestT * (B.y - A.y),
    z: A.z + bestT * (B.z - A.z),
  };

  // Incluir giros[0 .. bestSegIdx-1]: los que están antes del segmento de inflexión.
  // bestSegIdx 0 → segmento (startPos → giros[0]) → incluir 0 giros
  // bestSegIdx k → segmento (giros[k-1] → giros[k]) → incluir k giros
  return { turnPoint, girosToInclude: bestSegIdx };
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

    // 1. Filtrar paths por edificio / piso si se especifica en options.
    // Se eliminan los espacios antes de comparar para que "Piso 2" y "Piso2" coincidan.
    const normPiso = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, '');
    const normEd = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, '');

    const getPathFloor = (p) => {
      if (!p) return '';
      const raw = getFieldCI(p, 'piso') || p.piso || p.Piso || p['Piso '] || '';
      const str = raw.toString().trim().toLowerCase().replace(/\s+/g, '');
      if (str) return str;
      const idLower = (p.id || '').toLowerCase();
      if (idLower.includes('piso3')) return 'piso3';
      if (idLower.includes('piso2')) return 'piso2';
      if (idLower.includes('piso1')) return 'piso1';
      return '';
    };

    const getLocFloor = (l) => {
      if (!l) return '';
      const raw = getFieldCI(l, 'piso') || l['Piso '] || l.Piso || l.piso || l._coleccion || '';
      const str = raw.toString().trim().toLowerCase().replace(/\s+/g, '');
      if (/3/i.test(str)) return 'piso3';
      if (/2/i.test(str)) return 'piso2';
      if (/-1|sub/i.test(str)) return 'piso-1';
      if (/1/i.test(str)) return 'piso1';
      return str;
    };

    // 1. Buscar destino primero en navigation-paths
    let destMatch = findDestinationInPaths(allPaths, destino);
    let destPos = destMatch ? destMatch.position : null;
    let endPath = destMatch ? destMatch.path : null;

    // 2. Fallback: buscar en Locaciones
    let destLocPiso = '';
    let destLocEdificio = '';
    if (!destPos) {
      const loc = await this.locRepo.buscarGlobalPorNombre(destino);
      if (loc && loc.coordenadas) {
        destLocPiso = getLocFloor(loc);
        destLocEdificio = normEd(getFieldCI(loc, 'edificio') || loc.Edificio || loc._edificioNombre || loc._edificioId || '');

        let coords = { ...loc.coordenadas };
        // Las locaciones del Piso 1 en Firestore están en el sistema local del OBJ (x > 7 o y > 4).
        // Se normalizan al sistema de coordenadas mundo que usan los navigation-paths y Babylon.
        const isEdA = !destLocEdificio || destLocEdificio.includes('edificioa') || destLocEdificio === 'a';
        if (isEdA && (destLocPiso.includes('piso1') || destLocPiso === '1') && (coords.x > 7 || coords.y > 4)) {
          const xMundo = (coords.x - 22.74) * 0.51;
          const zMundo = (coords.y - 6.15) * 0.51;
          coords = { x: Number(xMundo.toFixed(2)), y: 0.05, z: Number(zMundo.toFixed(2)) };
        }
        destPos = coords;
      }
    }

    if (!destPos) {
      return null;
    }

    // 3. Determinar el piso objetivo efectivo
    const targetFloor = destLocPiso || (options.piso ? options.piso.toString().trim().toLowerCase().replace(/\s+/g, '') : '');
    const targetEdificio = destLocEdificio || normEd(options.edificio);

    // 4. Seleccionar endPath según el piso objetivo
    if (!endPath) {
      if (targetFloor) {
        endPath = allPaths.find((path) => {
          const pf = getPathFloor(path);
          const ed = normEd(getFieldCI(path, 'edificio'));
          const pisoMatch = pf && targetFloor && (pf.includes(targetFloor) || targetFloor.includes(pf));
          const edMatch = !targetEdificio || !ed || ed.includes(targetEdificio) || targetEdificio.includes(ed);
          return pisoMatch && edMatch;
        });
      }
      if (!endPath && targetEdificio) {
        endPath = allPaths.find((path) => {
          const ed = normEd(getFieldCI(path, 'edificio'));
          return ed && (ed.includes(targetEdificio) || targetEdificio.includes(ed));
        });
      }
      if (!endPath) {
        endPath = allPaths[0];
      }
    }

    // 5. Identificar path de inicio y punto de acceso inicial
    // Por defecto, empezar en el mismo piso del destino (a menos que se especifique origen en otro lugar)
    let startPath = endPath;
    let startPos = null;
    let selectedStartName = startName;

    if (startName && startName !== 'MainEntrance') {
      for (const path of allPaths) {
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
        startPos = destPos;
      }
    }

    // 4. Trazar ruta con punto de inflexión exacto
    // Para cada destino se calcula la proyección perpendicular sobre el camino
    // del pasillo. Ese punto interpolado (que puede estar entre dos giros) es
    // donde se realiza el giro en 90° hacia la sala, sin retroceder.
    const rawRoute = [{ ...startPos }];

    if (startPath === endPath) {
      const { giros } = extractNavPathPoints(startPath);
      const { turnPoint, girosToInclude } = findTurnPointOnPath(startPos, giros, destPos);
      giros.slice(0, girosToInclude).forEach((g) => rawRoute.push({ ...g }));
      rawRoute.push(turnPoint);
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

      let endGiroStart;
      if (commonAcc) {
        rawRoute.push({ ...commonAcc });
        endGiroStart = commonAcc;
      } else {
        const firstEndAcc = Object.values(endAccesos)[0];
        if (firstEndAcc) {
          rawRoute.push({ ...firstEndAcc });
          endGiroStart = firstEndAcc;
        } else {
          endGiroStart = startPos;
        }
      }

      const { turnPoint: endTurnPoint, girosToInclude: endGirosToInclude } =
        findTurnPointOnPath(endGiroStart, endGiros, destPos);
      endGiros.slice(0, endGirosToInclude).forEach((g) => rawRoute.push({ ...g }));
      rawRoute.push(endTurnPoint);
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
