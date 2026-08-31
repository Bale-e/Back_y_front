import { Map3dContainerComponent } from './map3d-container.component';
describe('Map3dContainerComponent search autocomplete', () => {
    it('should update datalist suggestions from matching locations', () => {
        const component = Map3dContainerComponent.createForTest({}, { run: (fn) => fn() }, { detectChanges: () => undefined });
        component.destinationOptions = ['Biblioteca', 'Sala de Tutorías 1', 'Recepción'];
        component.handleSearchInput('tut');
        expect(component.searchQuery).toBe('tut');
        expect(component.filteredDestinations).toEqual(['Sala de Tutorías 1']);
    });
    it('should populate search suggestions from Firestore location names', async () => {
        const firebaseService = {
            getLocacionesDeTodosLosEdificios: async () => [
                { Nombre: 'Biblioteca' },
                { nombre: 'Sala de Tutorías 1' }
            ]
        };
        const component = Map3dContainerComponent.createForTest(firebaseService, { run: (fn) => fn() }, { detectChanges: () => undefined });
        const suggestionsPanel = {
            style: { display: 'none' },
            innerHTML: '',
            querySelectorAll: () => [],
            addEventListener: () => undefined,
            removeEventListener: () => undefined
        };
        component.searchInputElement = { parentElement: { appendChild: () => undefined } };
        component.searchSuggestionsPanel = suggestionsPanel;
        component.searchQuery = 'b';
        await component.loadLocationOptions();
        expect(component.destinationOptions).toContain('Biblioteca');
        expect(component.destinationOptions).toContain('Sala de Tutorías 1');
        expect(component.filteredDestinations).toContain('Biblioteca');
        expect(component.filteredDestinations).toContain('Sala de Tutorías 1');
        expect(suggestionsPanel.innerHTML).toContain('Biblioteca');
    });
    it('should normalize and collect all location search values for a location object', () => {
        const component = Map3dContainerComponent.createForTest({}, { run: (fn) => fn() }, { detectChanges: () => undefined });
        const location = {
            Nombre: 'Sala A104',
            id: 'sala-a104',
            edificio: 'Edificio A',
            piso: '2',
            descripcion: 'Aula de cómputo'
        };
        const values = component.getLocationSearchValues(location);
        expect(values).toContain('Sala A104');
        expect(values).toContain('sala-a104');
        expect(values).toContain('Edificio A');
        expect(values).toContain('2');
        expect(values).toContain('Aula de cómputo');
        expect(values.filter(v => v === 'Sala A104').length).toBe(1);
    });
    it('should extract coordinates from uppercase X/Y/Z fields', () => {
        const component = Map3dContainerComponent.createForTest({}, { run: (fn) => fn() }, { detectChanges: () => undefined });
        const location = {
            Nombre: 'Sala A104',
            Coordenadas: { X: 33.233, Y: 0.561, Z: 1.241 }
        };
        const coordinate = component.extractCoordinateFromLocation(location);
        expect(coordinate).not.toBeNull();
        expect(coordinate.x).toBe(33.233);
        expect(coordinate.y).toBe(0.561);
        expect(coordinate.z).toBe(1.241);
    });
});
describe('Map3dContainerComponent camera focus sizing', () => {
    it('should calculate a tighter orthographic size for small focused objects and a wider one for larger objects', () => {
        const component = Map3dContainerComponent.createForTest({}, { run: (fn) => fn() }, { detectChanges: () => undefined });
        expect(component.calculateOrthoSizeForFocus(1.2)).toBe(6);
        expect(component.calculateOrthoSizeForFocus(12)).toBeGreaterThan(6);
    });
    it('should zoom in when clicking body 3 on building A first floor', () => {
        const component = Map3dContainerComponent.createForTest({}, { run: (fn) => fn() }, { detectChanges: () => undefined });
        component.currentBuilding = 'A';
        component.currentFloor = component.firstFloorModel;
        const targetCalls = [];
        component.camera = {
            setTarget: (target) => targetCalls.push(target)
        };
        component.scene = {
            getMeshByName: () => ({ getAbsolutePosition: () => ({ x: 3, y: 0, z: 4 }) })
        };
        component.focusOnMeshIfNeeded('cuerpo3');
        expect(component.orthoSize).toBe(17);
        expect(targetCalls.length).toBe(1);
        expect(targetCalls[0]).toEqual(jasmine.objectContaining({ x: 3, y: 0, z: 4 }));
    });
});
describe('Map3dContainerComponent viewport wheel handling', () => {
    it('should only prevent page scroll while the pointer is over the 3D viewport', () => {
        const component = Map3dContainerComponent.createForTest({}, { run: (fn) => fn() }, { detectChanges: () => undefined });
        const event = new Event('wheel', { cancelable: true });
        const preventDefaultSpy = spyOn(event, 'preventDefault');
        const stopPropagationSpy = spyOn(event, 'stopPropagation');
        component.handleViewportWheel(event);
        expect(preventDefaultSpy).not.toHaveBeenCalled();
        expect(stopPropagationSpy).not.toHaveBeenCalled();
        component.setViewportHoverState(true);
        component.handleViewportWheel(event);
        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(stopPropagationSpy).not.toHaveBeenCalled();
    });
});
describe('Map3dContainerComponent building A transition marker', () => {
    it('should return the expected marker data for each building B floor', () => {
        const component = Map3dContainerComponent.createForTest({}, { run: (fn) => fn() }, { detectChanges: () => undefined });
        component.currentBuilding = 'B';
        component.currentFloor = component.buildingBThirdFloorModel;
        expect(component.getBuildingATransitionMarkerState()).toEqual({
            label: 'Ir al Edificio A - Piso 3',
            position: { x: -0.49, y: 0.01, z: -11.40 }
        });
        component.currentFloor = component.buildingBSecondFloorModel;
        expect(component.getBuildingATransitionMarkerState()).toEqual({
            label: 'Ir al Edificio A - Piso 2',
            position: { x: -4.43, y: 0.01, z: -3.25 }
        });
        component.currentFloor = component.buildingBFirstFloorModel;
        expect(component.getBuildingATransitionMarkerState()).toEqual({
            label: 'Ir al mapa principal',
            position: { x: 12.18, y: 0.01, z: -0.23 }
        });
    });
});
