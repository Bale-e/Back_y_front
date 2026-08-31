/*
  Buscador de rutas basado en la colección navigation_paths.
  Esta utilidad construye una ruta en base a los datos de navegación disponibles en Firestore,
  conectando Accesos, Giros y Conexiones (POIs).
*/

import * as BABYLON from 'babylonjs';

export interface NavigationPath {
  id?: string;
  Edificio?: string;
  Piso?: string;
  Accesos?: Record<string, { x: number; y: number; z: number }> | Array<{ x: number; y: number; z: number }>;
  Giros?: Record<string, { x: number; y: number; z: number }> | Array<{ x: number; y: number; z: number }>;
  Conexiones?: Record<string, { x: number; y: number; z: number }>;
  accesses?: Record<string, number[][]>;
  turns?: number[][];
  pois?: Record<string, number[]>;
  [key: string]: any;
}

export interface RouteResult {
  startName: string;
  endName: string;
  startPathId?: string;
  endPathId?: string;
  coordinates: number[][];
}

const DEFAULT_START_NAME = 'MainEntrance';

/**
  Extrae coordenadas 3D {x, y, z} de distintos formatos (objeto {x,y,z}, array [x,y,z], mayúsculas X/Y/Z).
 */
export function extractVec3Point(obj: any): BABYLON.Vector3 | null {
  if (!obj) return null;

  if (Array.isArray(obj) && obj.length >= 3) {
    const x = Number(obj[0]);
    const y = Number(obj[1]);
    const z = Number(obj[2]);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      return new BABYLON.Vector3(x, y, z);
    }
  }

  if (typeof obj === 'object') {
    const src = obj.Coordenadas3D ?? obj['Coordenadas 3D'] ?? obj.Coordenadas ?? obj.coordenadas ?? obj;
    const getVal = (f: string) => {
      const key = Object.keys(src || {}).find(k => k.toLowerCase() === f.toLowerCase());
      return key !== undefined ? Number(src[key]) : NaN;
    };

    const x = getVal('x');
    const y = getVal('y');
    const z = getVal('z');

    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      return new BABYLON.Vector3(x, y, z);
    }
  }

  return null;
}

/**
  Extrae Accesos, Giros y Conexiones de un documento NavigationPath de Firestore.
 */
export function extractNavPathPoints(doc: NavigationPath): {
  accesos: Record<string, BABYLON.Vector3>;
  giros: BABYLON.Vector3[];
  conexiones: Record<string, BABYLON.Vector3>;
} {
  const accesos: Record<string, BABYLON.Vector3> = {};
  const giros: BABYLON.Vector3[] = [];
  const conexiones: Record<string, BABYLON.Vector3> = {};

  if (!doc || typeof doc !== 'object') {
    return { accesos, giros, conexiones };
  }

  // 1. Accesos
  const accesosData = doc.Accesos ?? doc.accesos;
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
  const girosData = doc.Giros ?? doc.giros ?? doc.Turns ?? doc.turns;
  if (girosData) {
    const items = Array.isArray(girosData) ? girosData : Object.values(girosData);
    for (const item of items) {
      const v = extractVec3Point(item);
      if (v) giros.push(v);
    }
  }

  // 3. Conexiones (POIs)
  const conexionesData = doc.Conexiones ?? doc.conexiones ?? doc.POIs ?? doc.pois;
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

/**
  Busca el POI destino en Conexiones o Accesos de cualquier path de la lista.
 */
export function findDestinationInPaths(
  paths: NavigationPath[],
  destinationName: string
): { path: NavigationPath; pointName: string; position: BABYLON.Vector3 } | null {
  if (!Array.isArray(paths) || paths.length === 0 || !destinationName) return null;
  const targetLower = destinationName.trim().toLowerCase();

  for (const path of paths) {
    const { accesos, conexiones } = extractNavPathPoints(path);

    // Buscar en conexiones
    for (const [name, pos] of Object.entries(conexiones)) {
      if (name.trim().toLowerCase() === targetLower || name.trim().toLowerCase().includes(targetLower)) {
        return { path, pointName: name, position: pos };
      }
    }

    // Buscar en accesos
    for (const [name, pos] of Object.entries(accesos)) {
      if (name.trim().toLowerCase() === targetLower || name.trim().toLowerCase().includes(targetLower)) {
        return { path, pointName: name, position: pos };
      }
    }
  }

  return null;
}

/**
  Elimina puntos consecutivos repetidos en una polilínea.
 */
function cleanDuplicatePoints(points: BABYLON.Vector3[], thresholdSq = 0.0001): BABYLON.Vector3[] {
  const result: BABYLON.Vector3[] = [];
  for (const pt of points) {
    if (result.length === 0) {
      result.push(pt.clone());
    } else {
      const prev = result[result.length - 1];
      const distSq = BABYLON.Vector3.DistanceSquared(prev, pt);
      if (distSq > thresholdSq) {
        result.push(pt.clone());
      }
    }
  }
  return result;
}

/**
  Construye la ruta completa desde un Acceso inicial -> Giros -> Desvío al POI destino.
 */
export function buildRoute(
  paths: NavigationPath[],
  startAccessName: string | null,
  destinationName: string,
  destMeshPos?: BABYLON.Vector3 | null
): BABYLON.Vector3[] {
  if (!Array.isArray(paths) || paths.length === 0) {
    return destMeshPos ? [destMeshPos.clone()] : [];
  }

  // 1. Identificar path del destino y posición del destino
  const destMatch = findDestinationInPaths(paths, destinationName);
  const endPath = destMatch ? destMatch.path : paths[0];
  const destPos = destMatch
    ? destMatch.position
    : destMeshPos
    ? destMeshPos
    : null;

  if (!destPos) {
    return [];
  }

  // 2. Identificar path de inicio y punto de acceso inicial
  let startPath = paths[0];
  let startPos: BABYLON.Vector3 | null = null;

  if (startAccessName) {
    for (const path of paths) {
      const { accesos } = extractNavPathPoints(path);
      const acc = Object.entries(accesos).find(([k]) => k.trim().toLowerCase() === startAccessName.trim().toLowerCase());
      if (acc) {
        startPath = path;
        startPos = acc[1];
        break;
      }
    }
  }

  if (!startPos) {
    // Usar el primer acceso disponible en startPath
    const { accesos: startAccesos } = extractNavPathPoints(startPath);
    const firstAccKey = Object.keys(startAccesos)[0];
    if (firstAccKey) {
      startPos = startAccesos[firstAccKey];
    } else if (paths.length > 0) {
      // Intentar en cualquier path
      for (const p of paths) {
        const { accesos } = extractNavPathPoints(p);
        const k = Object.keys(accesos)[0];
        if (k) {
          startPath = p;
          startPos = accesos[k];
          break;
        }
      }
    }
  }

  if (!startPos) {
    // Si no hay accesos definidos, retornar desde la posición del destino
    return [destPos.clone()];
  }

  // 3. Trazar ruta: startPos -> giros -> destPos
  const rawRoute: BABYLON.Vector3[] = [startPos.clone()];

  if (startPath === endPath) {
    const { giros } = extractNavPathPoints(startPath);
    giros.forEach(g => rawRoute.push(g.clone()));
    rawRoute.push(destPos.clone());
  } else {
    // Paths distintos: startPath -> acceso común -> endPath
    const { giros: startGiros, accesos: startAccesos } = extractNavPathPoints(startPath);
    const { giros: endGiros, accesos: endAccesos } = extractNavPathPoints(endPath);

    startGiros.forEach(g => rawRoute.push(g.clone()));

    // Buscar acceso común entre ambos paths
    let commonAcc: BABYLON.Vector3 | null = null;
    for (const keyA of Object.keys(startAccesos)) {
      if (keyA in endAccesos) {
        commonAcc = startAccesos[keyA];
        break;
      }
    }

    if (commonAcc) {
      rawRoute.push(commonAcc.clone());
    } else {
      const firstEndAcc = Object.values(endAccesos)[0];
      if (firstEndAcc) rawRoute.push(firstEndAcc.clone());
    }

    endGiros.forEach(g => rawRoute.push(g.clone()));
    rawRoute.push(destPos.clone());
  }

  const cleaned = cleanDuplicatePoints(rawRoute);
  console.log(`[RouteFinderService] buildRoute: ${cleaned.length} puntos generados para '${destinationName}'.`);
  return cleaned;
}

/**
  Función de compatibilidad con código/tests existentes.
 */
export function construirRutaDesdeNavigationPaths(
  navigationPaths: NavigationPath[],
  destinationName: string,
  startName: string = DEFAULT_START_NAME
): RouteResult | null {
  if (!Array.isArray(navigationPaths) || navigationPaths.length === 0) {
    return null;
  }

  const points = buildRoute(navigationPaths, startName, destinationName);
  if (points.length === 0) return null;

  return {
    startName,
    endName: destinationName,
    startPathId: navigationPaths[0]?.id,
    endPathId: navigationPaths[navigationPaths.length - 1]?.id,
    coordinates: points.map(p => [p.x, p.y, p.z])
  };
}
