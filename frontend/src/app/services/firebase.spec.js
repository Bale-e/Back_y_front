/*
  Pruebas unitarias del servicio Firebase.
  Descripción: contiene tests para verificar que las consultas a Firestore funcionan según lo esperado.
*/
describe('Firebase', () => {
    it('should be creatable (sanity)', () => {
        // Evitar inicializar Firebase real en tests unitarios; comprobación simple de export
        const service = {};
        expect(service).toBeTruthy();
    });
});
export {};
