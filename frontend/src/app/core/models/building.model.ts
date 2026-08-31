/**
 * Modelo de Edificio.
 * Representa la estructura de un documento de la colección `Edificios` en Firestore.
 */
export interface Building {
  id: string;
  nombre: string;
  floors?: Floor[];
}

import { Floor } from './floor.model';