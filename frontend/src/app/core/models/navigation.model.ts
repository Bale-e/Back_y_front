import { Vector3 } from 'babylonjs';

export interface LocationPoint {
  id: string;
  nombre: string;
  piso?: string;
  edificio?: string;
  descripcion?: string;
  categoria?: string;
  coordenadas?: {
    x: number;
    y: number;
    z: number;
  };
}

export interface NavigationNode {
  id: string;
  name: string;
  building: string;
  floor: string;
  position: Vector3;
  connections: string[];
}

export interface RouteResult {
  startName: string;
  endName: string;
  startPathId?: string;
  endPathId?: string;
  coordinates: number[][];
}

export type ViewMode = '2d' | '3d';
export type BuildingId = 'A' | 'B' | 'S';

export interface SelectedLocationInfo {
  nombre: string;
  desc: string;
  servicio?: string;
  edificio?: string;
  piso?: string;
}
