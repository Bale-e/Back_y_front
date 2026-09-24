export type BuildingId = 'A' | 'B' | 'C' | 'S';

export interface SelectedLocationInfo {
  nombre: string;
  desc: string;
  edificio?: string;
  piso?: string;
  cuerpo?: number | string;
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
