/**
 * Modelo de Piso (Floor).
 * Representa un piso dentro de un edificio.
 */
export interface Floor {
  id: string;
  /** Nombre descriptivo del piso, ej: "Piso 1", "Piso -1" */
  name: string;
  /** Offset vertical (Y) usado para posicionar el modelo 3D */
  zOffset?: number;
  /** Ruta relativa al archivo .obj del modelo 3D del piso */
  modelPath?: string;
}