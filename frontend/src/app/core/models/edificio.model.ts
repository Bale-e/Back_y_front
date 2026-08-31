export interface Edificio {
  id: string;
  Nombre?: string;
  nombre?: string;
  descripcion?: string;
  Pisos?: string[] | string;
  pisos?: string[] | string;
  cuerpo?: number | string;
  'Coordenadas 3D'?: { x: number; y: number; z: number };
  'Coordenadas 2D'?: { x: number; y: number };
  coordenadas?: { x: number; y: number; z: number };
  [key: string]: any;
}

export interface Piso {
  id: string;
  numero: number;
  nombre: string;
  modelPath?: string;
  zOffset?: number;
}
