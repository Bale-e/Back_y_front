const defaultNavRepo = require('../../infrastructure/repositories/FirestoreNavigationRepository');
const defaultLocRepo = require('../../../gestion_espacios/infrastructure/repositories/FirestoreLocacionRepository');
const defaultAStar = require('../../domain/services/AStarAlgorithm');
const ICalcularRutaUseCase = require('../ports/ICalcularRutaUseCase');
const RutaCalculadaResponseDto = require('../dtos/RutaCalculadaResponse.dto');
const NavigationPathDocumentMapper = require('../../infrastructure/mappers/NavigationPathDocumentMapper');
const { getFieldCI } = require('../../../gestion_espacios/infrastructure/helpers/firestoreHelpers');

/**
 * Calcula el punto exacto de inflexión en 90° sobre el camino del pasillo.
 */
function findTurnPointOnPath(startPos, giros, destPos) {
  if (!giros || giros.length === 0) {
    return { turnPoint: { ...destPos }, girosToInclude: 0 };
  }

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
      const dx = destPos.x - A.x, dy = destPos.y - A.y, dz = destPos.z - A.z;
      dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    } else {
      const apx = destPos.x - A.x, apy = destPos.y - A.y, apz = destPos.z - A.z;
      t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLen2));
      const projX = A.x + t * abx;
      const projY = A.y + t * aby;
      const projZ = A.z + t * abz;
      const dx = destPos.x - projX, dy = destPos.y - projY, dz = destPos.z - projZ;
      dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    if (dist < bestDist) {
      bestDist = dist;
      bestSegIdx = i;
      bestT = t;
    }
  }

  const A = pathPoints[bestSegIdx];
  const B = pathPoints[bestSegIdx + 1];
  const turnPoint = {
    x: Number((A.x + bestT * (B.x - A.x)).toFixed(3)),
    y: Number((A.y + bestT * (B.y - A.y)).toFixed(3)),
    z: Number((A.z + bestT * (B.z - A.z)).toFixed(3)),
  };

  return { turnPoint, girosToInclude: bestSegIdx };
}

function cleanDuplicatePoints(points, threshold = 0.05) {
  if (!points || points.length === 0) return [];
  const thresholdSq = threshold * threshold;
  const result = [];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
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
  constructor(navRepo = defaultNavRepo, locRepo = defaultLocRepo, pathfinder = defaultAStar) {
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

    const getPathEdificio = (p) => {
      if (!p) return '';
      const raw = getFieldCI(p, 'edificio') || p.edificio || p.Edificio || '';
      const str = raw.toString().trim().toLowerCase().replace(/\s+/g, '');
      if (str) return str;
      const idLower = (p.id || '').toLowerCase();
      if (idLower.includes('edificioa') || idLower.includes('-a')) return 'a';
      if (idLower.includes('edificiob') || idLower.includes('-b')) return 'b';
      if (idLower.includes('edificioc') || idLower.includes('-c')) return 'c';
      if (idLower.includes('edificiod') || idLower.includes('-d')) return 'd';
      if (idLower.includes('edificioe') || idLower.includes('-e')) return 'e';
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

    // 1. Buscar destino primero en navigation-paths (delegado al Mapper)
    let destMatch = NavigationPathDocumentMapper.findDestinationInPaths(allPaths, destino);
    let destPos = destMatch ? destMatch.position : null;
    let endPath = destMatch ? destMatch.path : null;

    // 2. Fallback: buscar en Locaciones
    let destLocPiso = '';
    let destLocEdificio = '';
    if (!destPos) {
      const loc = await this.locRepo.buscarGlobalPorNombre(destino);
      if (loc && loc.coordenadas) {
        destLocPiso = getLocFloor(loc);
        destLocEdificio = normEd(getFieldCI(loc, 'edificio') || loc.Edificio || loc.edificioNombre || loc.edificioId || '');

        let coords = { ...loc.coordenadas };
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
      console.warn(`[CalcularRutaUseCase Diagnostic] ⚠️ DATOS FALTANTES EN FIRESTORE:
  • Destino: '${destino}'
  • Edificio: ${targetEdificio || 'Desconocido'} | Piso: ${targetFloor || 'Desconocido'}
  • Causa: No se encontraron coordenadas 3D para esta sala en Firestore (aparecen vacías o null).
  • Dónde agregarlo: En la colección 'Edificios/${targetEdificio || 'ID_EDIFICIO'}/Locaciones' (o la subcolección correspondiente del piso), agregar el campo 'Coordenadas 3D' con { x: number, y: number, z: number }.
  • Efecto: No se puede calcular la ruta hasta que la sala tenga coordenadas asignadas.`);
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
          const ed = getPathEdificio(path);
          const pisoMatch = pf && targetFloor && (pf.includes(targetFloor) || targetFloor.includes(pf));
          const edMatch = !targetEdificio || !ed || ed.includes(targetEdificio) || targetEdificio.includes(ed);
          return pisoMatch && edMatch;
        });
      }
      if (!endPath && targetEdificio) {
        endPath = allPaths.find((path) => {
          const ed = getPathEdificio(path);
          return ed && (ed.includes(targetEdificio) || targetEdificio.includes(ed));
        });
      }
      if (!endPath) {
        console.warn(`[CalcularRutaUseCase Diagnostic] ⚠️ DATOS FALTANTES EN FIRESTORE:
  • Documento no encontrado: 'navigation-paths/NavPathEdificio${(targetEdificio || 'X').toUpperCase()}-${targetFloor || 'Piso1'}'
  • Causa: No existe el documento de navegación para el piso solicitado en la colección 'navigation-paths' de Firestore.
  • Dónde agregarlo: Crear el documento 'NavPathEdificio${(targetEdificio || 'X').toUpperCase()}-${targetFloor || 'Piso1'}' con:
      - Edificio: '${(targetEdificio || '').toUpperCase()}'
      - Piso: '${targetFloor || 'Piso 1'}'
      - Accesos: { EntradaPrincipal: { x, y, z }, Escalera: { x, y, z } }
      - Giros: [ { x, y, z }, ... ] (coordenadas de la línea central del pasillo)
  • Fallback: Se aplicó estimación de pasillo predeterminado.`);
        if (targetEdificio === 'b' || targetEdificio.includes('b')) {
          const floorNum = targetFloor.replace(/\D/g, '') || '1';
          const targetY = floorNum === '3' ? 0.86 : (floorNum === '2' ? 0.41 : 0.05);
          endPath = {
            id: `NavPathEdificioB-Piso${floorNum}`,
            edificio: 'B',
            piso: `Piso ${floorNum}`,
            Accesos: {
              ConectorEdificioA: { x: -0.50, y: targetY, z: -0.78 },
              Escalera: { x: -0.49, y: targetY, z: -11.40 },
            },
            Giros: [
              { x: -0.50, y: targetY, z: -11.40 },
              { x: -0.50, y: targetY, z: -3.15 },
              { x: -0.50, y: targetY, z: -0.78 },
              { x: -0.50, y: targetY, z: 8.00 },
            ],
          };
        } else if (targetEdificio === 'c' || targetEdificio.includes('c')) {
          const floorNum = targetFloor.replace(/\D/g, '') || '1';
          const targetY = floorNum === '2' ? 0.41 : 0.05;
          endPath = {
            id: `NavPathEdificioC-Piso${floorNum}`,
            edificio: 'C',
            piso: `Piso ${floorNum}`,
            Accesos: {
              EntradaPrincipal: { x: 4.60, y: targetY, z: 10.00 },
              Escalera: { x: -2.20, y: targetY, z: 9.70 },
            },
            Giros: [
              { x: 4.60, y: targetY, z: 10.00 },
              { x: 1.30, y: targetY, z: 9.90 },
              { x: -2.20, y: targetY, z: 9.70 },
              { x: -2.40, y: targetY, z: 6.30 },
              { x: -2.40, y: targetY, z: -2.20 },
            ],
          };
        } else if (targetEdificio === 'd' || targetEdificio.includes('d')) {
          const floorNum = targetFloor.replace(/\D/g, '') || '1';
          const targetY = floorNum === '2' ? 0.41 : 0.05;
          endPath = {
            id: `NavPathEdificioD-Piso${floorNum}`,
            edificio: 'D',
            piso: `Piso ${floorNum}`,
            Accesos: {
              InicioPasilloD: { x: -0.10, y: targetY, z: 11.10 },
              Escalera: { x: -1.00, y: targetY, z: 7.30 },
            },
            Giros: [
              { x: -0.10, y: targetY, z: 11.10 },
              { x: -0.05, y: targetY, z: 7.30 },
              { x: -0.03, y: targetY, z: 0.40 },
              { x: -0.02, y: targetY, z: -11.20 },
            ],
          };
        } else {
          endPath = allPaths[0];
        }
      }
    }

    // 5. Identificar path de inicio y punto de acceso inicial
    let startPath = endPath;
    let startPos = null;
    let selectedStartName = startName;

    if (startName && startName !== 'MainEntrance') {
      for (const path of allPaths) {
        const { accesos } = NavigationPathDocumentMapper.extractNavPathPoints(path);
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
      const { accesos: startAccesos } = NavigationPathDocumentMapper.extractNavPathPoints(startPath);
      const firstAccKey = Object.keys(startAccesos)[0];
      if (firstAccKey) {
        startPos = startAccesos[firstAccKey];
        selectedStartName = firstAccKey;
      } else {
        startPos = destPos;
      }
    }

    // 6. Trazar ruta con punto de inflexión exacto
    const rawRoute = [{ ...startPos }];

    let commonAcc = null;
    let commonAccKey = null;

    if (startPath === endPath) {
      const { giros } = NavigationPathDocumentMapper.extractNavPathPoints(startPath);
      const { turnPoint, girosToInclude } = findTurnPointOnPath(startPos, giros, destPos);
      giros.slice(0, girosToInclude).forEach((g) => rawRoute.push({ ...g }));
      rawRoute.push(turnPoint);
      rawRoute.push({ ...destPos });
    } else {
      const { giros: startGiros, accesos: startAccesos } = NavigationPathDocumentMapper.extractNavPathPoints(startPath);
      const { giros: endGiros, accesos: endAccesos } = NavigationPathDocumentMapper.extractNavPathPoints(endPath);

      startGiros.forEach((g) => rawRoute.push({ ...g }));

      for (const keyA of Object.keys(startAccesos)) {
        if (keyA in endAccesos) {
          commonAcc = startAccesos[keyA];
          commonAccKey = keyA;
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

    const coordinates = cleaned.map((p) => [
      Number(p.x.toFixed(2)),
      Number((p.y !== undefined ? p.y : 0.05).toFixed(2)),
      Number(p.z.toFixed(2)),
    ]);

    const result = {
      startName: selectedStartName,
      endName: destino,
      startPathId: startPath ? startPath.id : 'default',
      endPathId: endPath ? endPath.id : 'default',
      coordinates,
      distance: Number(totalDist.toFixed(2)),
    };

    if (commonAcc) {
      result.connectionName = commonAccKey;
      result.interBuilding = true;
    }

    return result;
  }
}

module.exports = new CalcularRutaUseCase();
