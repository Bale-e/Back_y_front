import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Map3dContainerComponent } from './map3d-container.component';
import { Firebase } from '../../../services/firebase';

describe('Map3dContainerComponent search autocomplete', () => {
  it('should update datalist suggestions from matching locations', () => {
    const component = Map3dContainerComponent.createForTest(
      {} as Firebase,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

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
    } as unknown as Firebase;

    const component = Map3dContainerComponent.createForTest(
      firebaseService,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

    const suggestionsPanel = {
      style: { display: 'none' },
      innerHTML: '',
      querySelectorAll: () => [],
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    } as unknown as HTMLDivElement;

    (component as any).searchInputElement = { parentElement: { appendChild: () => undefined } } as unknown as HTMLInputElement;
    (component as any).searchSuggestionsPanel = suggestionsPanel;
    (component as any).searchQuery = 'b';

    await (component as any).loadLocationOptions();

    expect(component.destinationOptions).toContain('Biblioteca');
    expect(component.destinationOptions).toContain('Sala de Tutorías 1');
    expect(component.filteredDestinations).toContain('Biblioteca');
    expect(component.filteredDestinations).toContain('Sala de Tutorías 1');
    expect(suggestionsPanel.innerHTML).toContain('Biblioteca');
  });

  it('should normalize and collect all location search values for a location object', () => {
    const component = Map3dContainerComponent.createForTest(
      {} as Firebase,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

    const location = {
      Nombre: 'Sala A104',
      id: 'sala-a104',
      edificio: 'Edificio A',
      piso: '2',
      descripcion: 'Aula de cómputo'
    } as any;

    const values = (component as any).getLocationSearchValues(location) as string[];

    expect(values).toContain('Sala A104');
    expect(values).toContain('sala-a104');
    expect(values).toContain('Edificio A');
    expect(values).toContain('2');
    expect(values).toContain('Aula de cómputo');
    expect(values.filter(v => v === 'Sala A104').length).toBe(1);
  });

  it('should extract coordinates from uppercase X/Y/Z fields', () => {
    const component = Map3dContainerComponent.createForTest(
      {} as Firebase,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

    const location = {
      Nombre: 'Sala A104',
      Coordenadas: { X: 33.233, Y: 0.561, Z: 1.241 }
    } as any;

    const coordinate = (component as any).extractCoordinateFromLocation(location) as any;

    expect(coordinate).not.toBeNull();
    expect(coordinate.x).toBe(33.233);
    expect(coordinate.y).toBe(0.561);
    expect(coordinate.z).toBe(1.241);
  });
});

describe('Map3dContainerComponent camera focus sizing', () => {
  it('should calculate a tighter orthographic size for small focused objects and a wider one for larger objects', () => {
    const component = Map3dContainerComponent.createForTest(
      {} as Firebase,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

    expect((component as any).calculateOrthoSizeForFocus(1.2)).toBe(6);
    expect((component as any).calculateOrthoSizeForFocus(12)).toBeGreaterThan(6);
  });

  it('should zoom in when clicking body 3 on building A first floor', () => {
    const component = Map3dContainerComponent.createForTest(
      {} as Firebase,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

    (component as any).currentBuilding = 'A';
    (component as any).currentFloor = (component as any).firstFloorModel;
    const targetCalls: any[] = [];
    (component as any).camera = {
      setTarget: (target: any) => targetCalls.push(target)
    };
    (component as any).scene = {
      getMeshByName: () => ({ getAbsolutePosition: () => ({ x: 3, y: 0, z: 4 }) })
    };

    (component as any).focusOnMeshIfNeeded('cuerpo3');

    expect(component.orthoSize).toBe(17);
    expect(targetCalls.length).toBe(1);
    expect(targetCalls[0]).toEqual(jasmine.objectContaining({ x: 3, y: 0, z: 4 }));
  });
});

describe('Map3dContainerComponent viewport wheel handling', () => {
  it('should only prevent page scroll while the pointer is over the 3D viewport', () => {
    const component = Map3dContainerComponent.createForTest(
      {} as Firebase,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

    const event = new Event('wheel', { cancelable: true }) as WheelEvent;
    const preventDefaultSpy = spyOn(event, 'preventDefault');
    const stopPropagationSpy = spyOn(event, 'stopPropagation');

    (component as any).handleViewportWheel(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(stopPropagationSpy).not.toHaveBeenCalled();

    (component as any).setViewportHoverState(true);
    (component as any).handleViewportWheel(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(stopPropagationSpy).not.toHaveBeenCalled();
  });
});

describe('Map3dContainerComponent building A transition marker', () => {
  it('should return the expected marker data for each building B floor', () => {
    const component = Map3dContainerComponent.createForTest(
      {} as Firebase,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

    (component as any).currentBuilding = 'B';
    (component as any).currentFloor = (component as any).buildingBThirdFloorModel;
    expect(component.getBuildingATransitionMarkerState()).toEqual({
      label: 'Ir al Edificio A - Piso 3',
      position: { x: -0.49, y: 0.01, z: -11.40 }
    });

    (component as any).currentFloor = (component as any).buildingBSecondFloorModel;
    expect(component.getBuildingATransitionMarkerState()).toEqual({
      label: 'Ir al Edificio A - Piso 2',
      position: { x: -4.43, y: 0.01, z: -3.25 }
    });

    (component as any).currentFloor = (component as any).buildingBFirstFloorModel;
    expect(component.getBuildingATransitionMarkerState()).toEqual({
      label: 'Ir al mapa principal',
      position: { x: 12.18, y: 0.01, z: -0.23 }
    });
  });
});
