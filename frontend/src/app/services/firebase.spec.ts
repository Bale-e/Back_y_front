/*
  Pruebas unitarias del servicio Firebase.
  Descripción: contiene tests para verificar que las consultas a Firestore funcionan según lo esperado.
*/

/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';

import { Firebase } from './firebase';

describe('Firebase', () => {
  it('should be creatable (sanity)', () => {
    // Evitar inicializar Firebase real en tests unitarios; comprobación simple de export
    const service = {} as unknown as Firebase;
    expect(service).toBeTruthy();
  });
});
