export type BuildingId = 'A' | 'B' | 'C' | 'D' | 'E' | 'S' | string;

export interface FloorDefinition {
  number: number;
  label: string; // e.g. "Piso 1"
  modelFile: string; // e.g. "Edificio D - Piso1.obj"
  modelDir?: string; // e.g. "/assets/3d-models/Edificio D/"
  elevation?: number; // Cota Y estándar para este piso
}

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  center: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  cameraBaseAlpha?: number;
  floors: FloorDefinition[];
  defaultStairs?: {
    nombre: string;
    worldPos: { x: number; z: number };
    landing: { x: number; z: number };
    threshold: { x: number; z: number };
  }[];
  corridorAxis?: 'x' | 'z';
  corridorFixedCoord?: number; // p. ej. X = -0.50 en B, X = -2.40 en C, X = -0.05 en D
}

export interface SelectedLocationInfo {
  nombre: string;
  desc: string;
  edificio?: string;
  piso?: string;
  cuerpo?: number | string;
  tipo?: string;
  isStair?: boolean;
}

export interface NavigationPath {
  id?: string;
  Edificio?: string;
  edificio?: string;
  Piso?: string;
  piso?: string;
  Accesos?: Record<string, { x: number; y: number; z: number }> | Array<{ x: number; y: number; z: number }>;
  Giros?: Record<string, { x: number; y: number; z: number }> | Array<{ x: number; y: number; z: number }>;
  Conexiones?: Record<string, { x: number; y: number; z: number }>;
  [key: string]: any;
}

export interface ArrowOrientation {
  angleDegrees: number;
  vectorDirection: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  length: number;
}

export interface Waypoint {
  id: string;
  point3d: { x: number; y: number; z: number };
  piso: string;
  orden: number;
  type: 'start' | 'intermediate' | 'end';
}

export interface VisualizacionRuta {
  waypoints: Waypoint[];
  arrows: ArrowOrientation[];
  smoothedPolyline: number[][];
  metadata?: any;
}

export interface RouteResult {
  startName: string;
  endName: string;
  startPathId?: string;
  endPathId?: string;
  coordinates: number[][];
  distance?: number;
  visualizacion?: VisualizacionRuta;
}
