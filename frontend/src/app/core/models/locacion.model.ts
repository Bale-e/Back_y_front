export interface Locacion {
  id: string;
  Nombre?: string;
  nombre?: string;
  Tipo?: string;
  tipo?: string;
  TIpo?: string;
  Piso?: string;
  piso?: string;
  'Piso '?: string;
  Cuerpo?: number | string;
  cuerpo?: number | string;
  coordenadas?: { x: number; y: number; z: number };
  'Coordenadas 3D'?: { x: number; y: number; z: number };
  'Coordenadas 2D'?: { x: number; y: number };
  _edificioId?: string;
  _edificioNombre?: string;
  _coleccion?: string;
  _coleccionPiso?: string;
  [key: string]: any;
}
