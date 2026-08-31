/*
  Componente principal contenedor del visor 3D (Map3dContainerComponent).
  Orquesta renderizado 3D, navegación, búsqueda y marcadores proyectados en pantalla.
*/
import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { BabylonSceneService, ScreenMarker } from '../../../core/services/babylon-scene.service';
import { MapNavigationService } from '../../../core/services/map-navigation.service';
import { BuildingId, SelectedLocationInfo } from '../../../core/models/navigation.model';
import { Subscription } from 'rxjs';
import { FloorSelectorComponent } from './floor-selector/floor-selector.component';

@Component({
  selector: 'app-map3d',
  templateUrl: './map3d-container.component.html',
  styleUrls: ['./map3d-container.component.scss']
})
export class Map3dContainerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('renderCanvas', { static: false })
  renderCanvasContainer!: ElementRef<HTMLDivElement>;

  @ViewChild(FloorSelectorComponent, { static: false })
  floorSelectorComponent?: FloorSelectorComponent;

  viewMode: '2d' | '3d' = '3d';
  currentBuilding: BuildingId = 'A';
  currentFloorModel = 'Edifico A - Piso 1.obj';

  destinations: string[] = [];
  // Alias esperado por los tests
  get destinationOptions(): string[] { return this.destinations; }
  set destinationOptions(v: string[]) { this.destinations = v; }
  selectedDestination: string | null = null;
  destinationCoordinatesText = '';
  selectedLocationInfo: SelectedLocationInfo | null = null;
  isDetailPanelOpen = false;

  // Búsqueda/autocomplete esperado por spec
  searchQuery = '';
  filteredDestinations: string[] = [];
  searchInputElement: HTMLInputElement | null = null;
  searchSuggestionsPanel: HTMLDivElement | null = null;

  // Hover del viewport (evitar scroll de página cuando pointer esté sobre canvas)
  private viewportHovered = false;

  // Si las pruebas inyectan un servicio Firebase simple lo guardamos aquí
  private firebaseService: any = null;

  screenMarkers: ScreenMarker[] = [];
  currentFloor = 'Edifico A - Piso 1.obj';
  floorDialogVisible = false;
  infoBox: HTMLDivElement | null = null;
  infoData: Record<string, { nombre: string; desc: string }> = {};
  boundaryNameRegExp = /boundary|border/i;
  engine: BABYLON.Engine | null = null;
  scene: BABYLON.Scene | null = null;
  camera: BABYLON.ArcRotateCamera | null = null;
  orthoSize = 50;
  defaultOrthoSize = 50;
  isTopDownView = false;
  topDownPanLimits = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  cameraBeforeRenderObserver: any = null;
  modelRoot: BABYLON.TransformNode | null = null;
  renderLoopFn: () => void = () => {};
  private onDocumentClick = (_: MouseEvent): void => {};

  private subscriptions = new Subscription();

  private babylonSceneService: BabylonSceneService;
  private mapNavService: MapNavigationService;
  private cd: ChangeDetectorRef;

  private readonly firstFloorModel = 'Edifico A - Piso 1.obj';
  private readonly secondFloorModel = 'Edificio A - piso 2.obj';
  private readonly thirdFloorModel = 'Edificio A - piso 3.obj';

  private readonly buildingBFirstFloorModel = 'Edificio B - Piso 1.obj';
  private readonly buildingBSecondFloorModel = 'Edificio B - Piso 2.obj';
  private readonly buildingBThirdFloorModel = 'Edificio B - Piso 3.obj';

  private readonly sedeModel = 'MODELO_INACAP_FIXED.obj';

  constructor(
    babylonSceneService: BabylonSceneService,
    mapNavService: MapNavigationService,
    cd: ChangeDetectorRef
  ) {
    this.babylonSceneService = babylonSceneService;
    this.mapNavService = mapNavService;
    this.cd = cd;
  }

  // Factory helper para tests: crea una instancia usando stubs y asigna el mock de Firebase
  static createForTest(firebaseService: any, _ngZone: any, cd: ChangeDetectorRef): Map3dContainerComponent {
    const fakeBabylon = {
      initScene: () => {},
      loadModel: () => {},
      setDestinationMarker: () => {},
      drawAnimatedRoute: () => {},
      clearGuideArrows: () => {},
      clearDestinationMarker: () => {},
      zoomIn: () => {},
      zoomOut: () => {},
      resetCamera: () => {},
      focusOnMesh: () => {},
      getMeshByName: () => null,
      dispose: () => {}
    } as unknown as BabylonSceneService;

    const fakeMapNav = {
      currentFloor$: { subscribe: (_: any) => ({ unsubscribe: () => {} }) } as any,
      currentBuilding$: { subscribe: (_: any) => ({ unsubscribe: () => {} }) } as any,
      destinations$: { subscribe: (_: any) => ({ unsubscribe: () => {} }) } as any,
      loadDestinations: () => {},
      setFloor: (_: string) => {},
      calculateRoute: async (_: string) => null,
      getLocationInfoByMeshNameAsync: async (_: string) => null
    } as unknown as MapNavigationService;

    const comp = new Map3dContainerComponent(fakeBabylon, fakeMapNav, cd);
    (comp as any).firebaseService = firebaseService;
    return comp;
  }

  // --- Métodos y utilidades que la spec espera ---
  public handleSearchInput(query: string): void {
    this.searchQuery = query;
    const q = (query || '').toLowerCase();
    this.filteredDestinations = this.destinationOptions.filter(d => (d || '').toLowerCase().includes(q));
  }

  public async loadLocationOptions(): Promise<void> {
    if (!this.firebaseService || typeof this.firebaseService.getLocacionesDeTodosLosEdificios !== 'function') return;
    const locs = await this.firebaseService.getLocacionesDeTodosLosEdificios();
    const namesSet = new Set<string>();
    for (const l of (locs || [])) {
      if (!l) continue;
      if (l.Nombre) namesSet.add(String(l.Nombre));
      if (l.nombre) namesSet.add(String(l.nombre));
    }
    const names = Array.from(namesSet) as string[];
    // Debug: mostrar datos durante tests si falla
    console.log('loadLocationOptions locs:', locs, 'names:', names);
    this.destinationOptions = names;
    // Inicializar filtered con todas las opciones (las specs esperan la lista completa tras cargar)
    this.filteredDestinations = [...this.destinationOptions];
    if (this.searchSuggestionsPanel) {
      this.searchSuggestionsPanel.innerHTML = this.destinationOptions.map(d => `<div class="suggestion">${d}</div>`).join('');
    }
  }

  public getLocationSearchValues(location: any): string[] {
    const values: string[] = [];
    if (!location) return values;
    const pushOnce = (v: any) => { if (v != null) { const s = String(v); if (!values.includes(s)) values.push(s); } };
    pushOnce(location.Nombre ?? location.nombre);
    pushOnce(location.id);
    pushOnce(location.edificio);
    pushOnce(location.piso);
    pushOnce(location.descripcion ?? location.desc);
    return values;
  }

  public extractCoordinateFromLocation(location: any): { x: number; y: number; z: number } | null {
    if (!location) return null;
    const c = location.Coordenadas ?? location.coordenadas ?? location.coordinate ?? null;
    if (!c) return null;
    const x = c.X ?? c.x ?? null;
    const y = c.Y ?? c.y ?? null;
    const z = c.Z ?? c.z ?? null;
    if (x == null || y == null || z == null) return null;
    return { x: Number(x), y: Number(y), z: Number(z) };
  }

  public calculateOrthoSizeForFocus(size: number): number {
    // Base simple: garantizar al menos 6 y escalar según tamaño
    return Math.max(6, Math.ceil(size * 5));
  }

  public handleViewportWheel(e: WheelEvent): void {
    if (this.viewportHovered) {
      if (e.cancelable) e.preventDefault();
      // no stopPropagation según spec
    }
  }

  public setViewportHoverState(state: boolean): void {
    this.viewportHovered = !!state;
  }

  ngAfterViewInit(): void {
    if (this.renderCanvasContainer?.nativeElement) {
      this.babylonSceneService.initScene(
        this.renderCanvasContainer.nativeElement,
        (meshName, pickResult) => this.onMeshPicked(meshName, pickResult),
        (markers) => this.onMarkersUpdated(markers)
      );
    }

    this.subscriptions.add(
      this.mapNavService.destinations$.subscribe(dests => {
        this.destinations = dests;
        console.log('DESTINATIONS CARGADOS:', dests.length, dests);
        this.cd.detectChanges();
      })
    );

    this.subscriptions.add(
      this.mapNavService.currentFloor$.subscribe(floorModel => {
        this.currentFloorModel = floorModel;
        this.currentFloor = floorModel;
        this.babylonSceneService.loadModel(floorModel, this.currentBuilding);
        this.cd.detectChanges();
      })
    );

    this.subscriptions.add(
      this.mapNavService.destinations$.subscribe(dests => {
        this.destinations = dests;
        this.cd.detectChanges();
      })
    );

    this.mapNavService.loadDestinations();

    setTimeout(async () => {
      const locs = await (this.mapNavService as any).firebaseService.getLocacionesDeTodosLosEdificios();
      const cuerpo9Segundo = locs.filter((l: any) => {
        const cuerpo = l.Cuerpo ?? l.cuerpo;
        const piso = (l.Piso ?? l.piso ?? '').toString().toLowerCase();
        return (cuerpo === 9 || cuerpo === '9') && piso.includes('2');
      });
      console.log('CUERPO 9 PISO 2 ENCONTRADO:', cuerpo9Segundo);
    }, 3000);
  }
  onMarkersUpdated(markers: ScreenMarker[]): void {
    this.screenMarkers = markers;
    this.cd.detectChanges();
  }

 onMarkerClicked(marker: ScreenMarker): void {
    if (marker.type === 'building-b') {
      this.goToBuildingBSameFloor();
    } else if (marker.type === 'building-a') {
      this.goToBuildingASameFloor();
    } else if (marker.type === 'sede') {
      this.onBuildingSelected('S');
    }
  }

  private getCurrentFloorNumber(): 'first' | 'second' | 'third' {
    if (this.currentFloor === this.secondFloorModel || this.currentFloor === this.buildingBSecondFloorModel) {
      return 'second';
    }
    if (this.currentFloor === this.thirdFloorModel || this.currentFloor === this.buildingBThirdFloorModel) {
      return 'third';
    }
    return 'first';
  }
  public getFloorColorClass(): string {
    const floorKey = this.getCurrentFloorNumber();
    if (floorKey === 'second') return 'floor-color-second';
    if (floorKey === 'third') return 'floor-color-third';
    return '';
  }

  private goToBuildingBSameFloor(): void {
    const floorKey = this.getCurrentFloorNumber();
    this.currentBuilding = 'B';
    const targetFloor = floorKey === 'second'
      ? this.buildingBSecondFloorModel
      : floorKey === 'third'
        ? this.buildingBThirdFloorModel
        : this.buildingBFirstFloorModel;
    this.currentFloor = targetFloor;
    this.mapNavService.setBuilding('B');
    this.mapNavService.setFloor(targetFloor);
  }

  private goToBuildingASameFloor(): void {
    const floorKey = this.getCurrentFloorNumber();
    this.currentBuilding = 'A';
    const targetFloor = floorKey === 'second'
      ? this.secondFloorModel
      : floorKey === 'third'
        ? this.thirdFloorModel
        : this.firstFloorModel;
    this.currentFloor = targetFloor;
    this.mapNavService.setBuilding('A');
    this.mapNavService.setFloor(targetFloor);
  }
async onMeshPicked(meshName: string, pickResult?: any): Promise<void> {
    try {
      const normalizedMeshName = meshName.replace(/[^a-z0-9]/gi, '').toLowerCase();

      const isSede =
        this.currentBuilding === 'S' ||
        this.currentFloor === this.sedeModel ||
        normalizedMeshName.includes('sede') ||
        normalizedMeshName.includes('untitled') ||
        normalizedMeshName.includes('fixed');

      if (isSede) {
        // No abrir tarjetas de salas ni cuadros emergentes para el mapa de la Sede
        this.closeDetailPanel();
        if (this.infoBox) this.infoBox.style.display = 'none';
        return;
      }

      // Si este mesh es un disparador del selector de piso (ej. escaleras),
      // abrir el selector de piso y no mostrar el panel de detalle de ubicación.
      if (this.isFloorSelectionTrigger(meshName)) {
        this.floorSelectorComponent?.openDialog();
        this.closeDetailPanel();
        if (this.infoBox) this.infoBox.style.display = 'none';
        return;
      }

      this.focusOnMeshIfNeeded(meshName);

      const info = await this.mapNavService.getLocationInfoByMeshNameAsync(normalizedMeshName);

      if (info) {
        this.selectedLocationInfo = info;
        this.isDetailPanelOpen = true;
        this.cd.detectChanges();
      } else {
        this.closeDetailPanel();
        if (this.infoBox) this.infoBox.style.display = 'none';
      }
    } catch (err) {
      console.error('ERROR en onMeshPicked:', err);
    }
  }

  private focusOnMeshIfNeeded(meshName: string): void {
    // Normalización agresiva: quita todo lo que no sea letra o número
    // (esto maneja casos como "Cuerpo10 (3)" -> "cuerpo10")
    const baseNameMatch = (meshName || '').match(/^[a-zA-Z]+\d+/);
    const normalizedMeshName = baseNameMatch
      ? baseNameMatch[0].toLowerCase()
      : (meshName || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

    const firstFloorBodies = ['cuerpo1', 'cuerpo2', 'cuerpo3', 'cuerpo4', 'cuerpo5', 'cuerpo6', 'cuerpo7', 'cuerpo9', 'cuerpo10', 'cuerpo11', 'cuerpo12', 'cuerpo13', 'cuerpo15', 'cuerpo16', 'cuerpo17', 'cuerpo18', 'cuerpo20', 'cuerpo24', 'cuerpo26', 'cuerpo27', 'cuerpo28', 'cuerpo29', 'cuerpo30'];
    const buildingBFirstFloorBodies = ['cuerpo79', 'cuerpo77', 'cuerpo76', 'cuerpo78'];
    const secondFloorBodies = ['cuerpo22', 'cuerpo21', 'cuerpo20', 'cuerpo6', 'cuerpo13', 'cuerpo15', 'cuerpo17', 'cuerpo19', 'cuerpo12', 'cuerpo10', 'cuerpo7', 'cuerpo9', 'cuerpo14', 'cuerpo16', 'cuerpo11', 'cuerpo5', 'cuerpo18', 'cuerpo3', 'cuerpo29', 'cuerpo2', 'cuerpo4', 'cuerpo1'];
    const thirdFloorBodies = ['cuerpo13', 'cuerpo2', 'cuerpo70', 'cuerpo68', 'cuerpo11', 'cuerpo1', 'cuerpo12', 'cuerpo23', 'cuerpo55', 'cuerpo5', 'cuerpo7', 'cuerpo21', 'cuerpo14', 'cuerpo3', 'cuerpo75', 'cuerpo79', 'cuerpo15', 'cuerpo4', 'cuerpo8', 'cuerpo40', 'cuerpo18', 'cuerpo46', 'cuerpo9', 'cuerpo20', 'cuerpo22', 'cuerpo10'];

    const isFirstFloor = this.currentFloor === this.firstFloorModel || this.currentFloor === this.buildingBFirstFloorModel;
    const isSecondFloor = this.currentFloor === this.secondFloorModel || this.currentFloor === this.buildingBSecondFloorModel;
    const isThirdFloor = this.currentFloor === this.thirdFloorModel || this.currentFloor === this.buildingBThirdFloorModel;

    const shouldFocus = (
      (this.currentBuilding === 'A' && isFirstFloor && firstFloorBodies.includes(normalizedMeshName)) ||
      (this.currentBuilding === 'B' && this.currentFloor === this.buildingBFirstFloorModel && buildingBFirstFloorBodies.includes(normalizedMeshName)) ||
      (isSecondFloor && secondFloorBodies.includes(normalizedMeshName)) ||
      (this.currentBuilding === 'B' && this.currentFloor === this.buildingBThirdFloorModel && /^cuerpo/i.test(normalizedMeshName)) ||
      (isThirdFloor && thirdFloorBodies.includes(normalizedMeshName))
    );

    if (!shouldFocus) {
      return;
    }

    const flippedBodiesFirstFloor = ['cuerpo3', 'cuerpo7', 'cuerpo18', 'cuerpo15', 'cuerpo4', 'cuerpo6',
    'cuerpo17', 'cuerpo16', 'cuerpo5', 'cuerpo79', 'cuerpo77', 'cuerpo76', 'cuerpo78']; // sin cambios, piso 1 funciona bien; B piso 1 internos

    const flippedBodiesSecondFloor = ['cuerpo2', 'cuerpo4', 'cuerpo1', 'cuerpo3', 'cuerpo5', 'cuerpo16', 'cuerpo9', 'cuerpo19', 'cuerpo10', 'cuerpo17', 'cuerpo15', 'cuerpo20', 'cuerpo21', 'cuerpo22'];
    const flippedBodiesThirdFloor = ['cuerpo40', 'cuerpo72', 'cuerpo4', 'cuerpo3', 'cuerpo67', 'cuerpo68',
    'cuerpo57', 'cuerpo59'];

    const shouldFlip =
    (isFirstFloor && flippedBodiesFirstFloor.includes(normalizedMeshName)) ||
    (isSecondFloor && flippedBodiesSecondFloor.includes(normalizedMeshName)) ||
    (this.currentBuilding === 'B' && this.currentFloor === this.buildingBThirdFloorModel && /^cuerpo/i.test(normalizedMeshName)) ||
    (isThirdFloor && flippedBodiesThirdFloor.includes(normalizedMeshName));

    const baseAlphaSecondFloor = Math.PI / 2;
    const baseAlphaThirdFloor = Math.PI / 2;
    const currentBaseAlpha = isSecondFloor ? baseAlphaSecondFloor : (isThirdFloor ? baseAlphaThirdFloor : Math.PI / 2);

    this.babylonSceneService.focusOnMesh(meshName, 9, 1800, shouldFlip, currentBaseAlpha);
  }
  private animateCameraFocus(targetVector: BABYLON.Vector3, targetOrthoSize: number, durationMs = 700): void {
    if (!this.camera) return;

    const startTarget = this.camera.target.clone();
    const startOrthoSize = this.orthoSize;
    const startTime = performance.now();

    const animateStep = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out

      if (this.camera) {
        const newTarget = BABYLON.Vector3.Lerp(startTarget, targetVector, eased);
        this.camera.setTarget(newTarget);
      }

      this.orthoSize = startOrthoSize + (targetOrthoSize - startOrthoSize) * eased;
      this.updateOrthoCamera();

      if (t < 1) {
        requestAnimationFrame(animateStep);
      }
    };

    requestAnimationFrame(animateStep);
  }

  private switchFloorByPisoName(pisoStr: string, edificio?: BuildingId): void {
    const targetBuilding = edificio || this.currentBuilding;
    if (targetBuilding !== this.currentBuilding) {
      this.onBuildingSelected(targetBuilding);
    }

    const pisoLower = pisoStr.toLowerCase().replace(/\s+/g, '');
    if (pisoLower.includes('2') || pisoLower.includes('piso2')) {
      this.onFloorSelected('second');
    } else if (pisoLower.includes('3') || pisoLower.includes('piso3')) {
      this.onFloorSelected('third');
    } else if (pisoLower.includes('1') || pisoLower.includes('piso1')) {
      this.onFloorSelected('first');
    }
  }
  async onDestinationSelected(destinationName: string): Promise<void> {
    this.selectedDestination = destinationName;
    const result = await this.mapNavService.calculateRoute(
      destinationName,
      (locName, cuerpoId) => this.babylonSceneService.getMeshWorldPosition(locName, cuerpoId)
    );
    if (result) {
      if (result.piso) {
        this.switchFloorByPisoName(result.piso, result.edificio);
      }
      this.destinationCoordinatesText = result.statusText;
      this.babylonSceneService.setDestinationMarker(result.coord);

      // Los routePoints de buildRoute contienen coordenadas en el espacio local del modelo OBJ
      // (exactamente como están almacenadas en Firestore). Se deben transformar a espacio mundo
      // usando localToWorld() para que las flechas se dibujen dentro del pasillo correcto.
      //
      // Excepción: el último punto puede haber sido obtenido con getMeshWorldPosition() y ya
      // estará en espacio mundo. En ese caso usamos result.coord directamente (que ES el
      // meshPos / destino final ya transformado).
      const rawPoints = result.routePoints;
      const worldPoints = rawPoints.map((pt, i) => {
        if (i === rawPoints.length - 1) {
          // El punto final es el destino — result.coord ya está en espacio mundo
          return result.coord.clone();
        }
        // Puntos intermedios (Accesos, Giros de navigation-paths) → transformar local→mundo
        return this.babylonSceneService.localToWorld(pt);
      });

      this.babylonSceneService.drawAnimatedRoute(worldPoints);
    } else {
      this.destinationCoordinatesText = `No se encontró la locación '${destinationName}'.`;
    }
    this.cd.detectChanges();
  }

  onSearchCleared(): void {
    this.selectedDestination = null;
    this.destinationCoordinatesText = '';
    this.babylonSceneService.clearGuideArrows();
    this.babylonSceneService.clearDestinationMarker();
  }

  onZoomIn(): void {
    this.babylonSceneService.zoomIn();
    if (this.camera && this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      this.orthoSize = Math.max(2, this.orthoSize - 3);
      this.updateOrthoCamera();
    } else if (this.camera) {
      this.camera.radius = Math.max(2, this.camera.radius - 3);
    }
  }

  onFloorSelected(floorKey: string): void {
    const targetFloor = this.currentBuilding === 'B'
      ? floorKey === 'first'
        ? this.buildingBFirstFloorModel
        : floorKey === 'second'
          ? this.buildingBSecondFloorModel
          : this.buildingBThirdFloorModel
      : floorKey === 'first'
        ? this.firstFloorModel
        : floorKey === 'second'
          ? this.secondFloorModel
          : this.thirdFloorModel;

    this.currentFloor = targetFloor;
    this.mapNavService.setFloor(targetFloor);
  }


  closeFloorDialog(): void {
    this.floorDialogVisible = false;
  }

  private handleBuildingBMarkerClick(): void {
    if (this.currentFloor === this.secondFloorModel) {
      this.goToBuildingBSecondFloor();
    } else if (this.currentFloor === this.thirdFloorModel) {
      this.goToBuildingBThirdFloor();
    } else {
      this.goToBuildingBFirstFloor();
    }
  }

  public isFloorSelectionTrigger(meshName: string | null | undefined): boolean {
    const normalizedMeshName = meshName?.replace(/\s+/g, '').toLowerCase();
    if (!normalizedMeshName) {
      return false;
    }

    if (this.currentBuilding === 'A' && this.currentFloor === this.firstFloorModel) {
      return ['cuerpo21', 'cuerpo14'].includes(normalizedMeshName);
    }

    if (this.currentBuilding === 'A' && this.currentFloor === this.secondFloorModel) {
      return ['cuerpo23', 'cuerpo26', 'cuerpo8', 'cuerpo25', 'cuerpo30'].includes(normalizedMeshName);
    }

    if (this.currentBuilding === 'A' && this.currentFloor === this.thirdFloorModel) {
      return ['cuerpo6', 'cuerpo45', 'cuerpo26', 'cuerpo39'].includes(normalizedMeshName);
    }

    if (this.currentBuilding === 'B' && this.currentFloor === this.buildingBSecondFloorModel) {
      return ['cuerpo9'].includes(normalizedMeshName);
    }

    if (this.currentBuilding === 'B' && this.currentFloor === this.buildingBFirstFloorModel) {
      return ['cuerpo0', 'cuerpo97'].includes(normalizedMeshName);
    }

    return false;
  }

  private goToBuildingBFirstFloor(): void {
    this.currentBuilding = 'B';
    this.currentFloor = this.buildingBFirstFloorModel;
    this.mapNavService.setBuilding('B');
    this.mapNavService.setFloor(this.buildingBFirstFloorModel);
  }

  private goToBuildingBSecondFloor(): void {
    this.currentBuilding = 'B';
    this.currentFloor = this.buildingBSecondFloorModel;
    this.mapNavService.setBuilding('B');
    this.mapNavService.setFloor(this.buildingBSecondFloorModel);
  }

  private goToBuildingBThirdFloor(): void {
    this.currentBuilding = 'B';
    this.currentFloor = this.buildingBThirdFloorModel;
    this.mapNavService.setBuilding('B');
    this.mapNavService.setFloor(this.buildingBThirdFloorModel);
  }

  private goToBuildingAFirstFloor(): void {
    this.currentBuilding = 'A';
    this.currentFloor = this.firstFloorModel;
    this.mapNavService.setBuilding('A');
    this.mapNavService.setFloor(this.firstFloorModel);
  }

  private goToBuildingASecondFloor(): void {
    this.currentBuilding = 'A';
    this.currentFloor = this.secondFloorModel;
    this.mapNavService.setBuilding('A');
    this.mapNavService.setFloor(this.secondFloorModel);
  }

  private goToBuildingAThirdFloor(): void {
    this.currentBuilding = 'A';
    this.currentFloor = this.thirdFloorModel;
    this.mapNavService.setBuilding('A');
    this.mapNavService.setFloor(this.thirdFloorModel);
  }

  private goToSede(): void {
    this.currentBuilding = 'S';
    this.currentFloor = this.sedeModel;
    this.mapNavService.setBuilding('S');
    this.mapNavService.setFloor(this.sedeModel);
  }

  public selectBuilding(building: 'A' | 'B'): void {
    this.floorDialogVisible = false;
    if (building === 'A') {
      this.goToBuildingAFirstFloor();
    } else {
      this.goToBuildingBFirstFloor();
    }
  }

  private handleBuildingAMarkerClick(): void {
    if (this.currentFloor === this.buildingBThirdFloorModel) {
      this.goToBuildingAThirdFloor();
    } else if (this.currentFloor === this.buildingBSecondFloorModel) {
      this.goToBuildingASecondFloor();
    } else if (this.currentFloor === this.buildingBFirstFloorModel) {
      this.goToSede();
    } else {
      this.goToBuildingAFirstFloor();
    }
  }

  public getBuildingATransitionMarkerState(): { label: string; position: { x: number; y: number; z: number } } | null {
    if (this.currentBuilding !== 'B') {
      return null;
    }

    if (this.currentFloor === this.buildingBThirdFloorModel) {
      return {
        label: 'Ir al Edificio A - Piso 3',
        position: { x: -0.49, y: 0.01, z: -11.40 }
      };
    }

    if (this.currentFloor === this.buildingBSecondFloorModel) {
      return {
        label: 'Ir al Edificio A - Piso 2',
        position: { x: -4.43, y: 0.01, z: -3.25 }
      };
    }

    if (this.currentFloor === this.buildingBFirstFloorModel) {
      return {
        label: 'Ir al mapa principal',
        position: { x: 12.18, y: 0.01, z: -0.23 }
      };
    }

    return null;
  }

  changeFloor(floor: string): void {
    this.currentFloor = floor;
    this.mapNavService.setFloor(floor);
  }

  private init3dScene(): void {
    this.dispose3d();

    const canvasContainer = this.renderCanvasContainer?.nativeElement;
    if (!canvasContainer) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'babylon-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // Evitar que la rueda del ratón haga scroll en la página, y usarla para hacer zoom real (orthoSize)
    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        this.onZoomIn();
      } else if (e.deltaY > 0) {
        this.onZoomOut();
      }
    }, { passive: false });

    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);

    this.engine = new BABYLON.Engine(canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.08, 0.08, 0.1, 1);

    // Resetear orthoSize al inicializar escena
    this.orthoSize = this.defaultOrthoSize;

    const isSede = this.currentFloor === this.sedeModel || this.currentBuilding === 'S';

    const initialAlpha = (isSede || this.isTopDownView) ? -Math.PI / 2 : -Math.PI / 3;
    const initialBeta = isSede ? 1.25 : (this.isTopDownView ? 0.12 : Math.PI / 5);
    // iniciar un 30% más cerca para una vista inicial más próxima
    const initialRadius = (this.isTopDownView ? 30 : 28) * 0.7;

    this.camera = new BABYLON.ArcRotateCamera('camera', initialAlpha, initialBeta, initialRadius, BABYLON.Vector3.Zero(), this.scene);
    this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = -1000;
    this.camera.maxZ = 1000;
    this.camera.attachControl(canvas, false, false);
    this.camera.wheelDeltaPercentage = 0.01;
    // permitir acercarse más (valor mínimo reducido) para respetar el zoom inicial
    this.camera.lowerRadiusLimit = 2;
    this.camera.upperRadiusLimit = 150;
    this.camera.panningSensibility = 25;
    this.camera.checkCollisions = true;
    this.camera.collisionRadius = new BABYLON.Vector3(0.75, 0.75, 0.75);
    this.camera.setTarget(BABYLON.Vector3.Zero());

    if (isSede) {
      this.camera.panningAxis = new BABYLON.Vector3(1, 0, 1);
      // Habilitar rotación del modelo completa (~26° en alpha y ~14° en beta)
      const rotMarginAlpha = 0.45;
      const rotMarginBeta = 0.25;
      this.camera.lowerAlphaLimit = initialAlpha - rotMarginAlpha;
      this.camera.upperAlphaLimit = initialAlpha + rotMarginAlpha;
      this.camera.lowerBetaLimit = Math.max(0.1, initialBeta - rotMarginBeta);
      this.camera.upperBetaLimit = Math.min(Math.PI / 2 - 0.05, initialBeta + rotMarginBeta);
    } else if (this.isTopDownView) {
      this.camera.panningAxis = new BABYLON.Vector3(1, 0, 1);
      this.camera.lowerAlphaLimit = this.camera.upperAlphaLimit = this.camera.alpha;
      this.camera.lowerBetaLimit = this.camera.upperBetaLimit = this.camera.beta;
    } else {
      this.camera.panningAxis = new BABYLON.Vector3(1, 0, 0);
      // límites más estrictos para evitar que la cámara mire por debajo del suelo
      this.camera.lowerBetaLimit = 0.05;
      this.camera.upperBetaLimit = Math.PI / 2 - 0.05;
    }

    // Permitir movimiento horizontal en X solo cuando se haya hecho zoom suficiente (>=30%)
    const fixedCameraY = 0;
    const maxPanX = 5;
    const minPanX = -5;
    const orthoMin = 2; // tamaño ortho más cercano (zoom máximo)
    const orthoMax = 100; // tamaño ortho más lejano (zoom mínimo)
    const topDownMinX = this.topDownPanLimits.minX;
    const topDownMaxX = this.topDownPanLimits.maxX;
    const topDownMinZ = this.topDownPanLimits.minZ;
    const topDownMaxZ = this.topDownPanLimits.maxZ;

    if (this.scene) {
      this.cameraBeforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
        const camera = this.camera;
        if (!camera) return;
        try {
          const target = camera.target;
          let modified = false;
          const newTarget = target.clone();

          // Mantener Y fijo siempre
          if (newTarget.y !== fixedCameraY) {
            newTarget.y = fixedCameraY;
            modified = true;
          }

          // Determinar si se permite paneo horizontal según el nivel de zoom
          let allowPan = false;
          if (camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
            const clamped = Math.min(Math.max(this.orthoSize, orthoMin), orthoMax);
            const zoomPercent = (orthoMax - clamped) / (orthoMax - orthoMin); // 0..1
            allowPan = zoomPercent >= 0.3; // permitir paneo a partir de 30% de zoom
          } else {
            const lower = camera.lowerRadiusLimit ?? 1;
            const upper = camera.upperRadiusLimit ?? 100;
            const clampedRad = Math.min(Math.max(camera.radius, lower), upper);
            const zoomPercent = (upper - clampedRad) / Math.max(upper - lower, 1);
            allowPan = zoomPercent >= 0.3;
          }

          if (isSede) {
            const sedeMinX = -80;
            const sedeMaxX = 80;
            const sedeMinZ = -80;
            const sedeMaxZ = 80;
            if (newTarget.x > sedeMaxX) {
              newTarget.x = sedeMaxX;
              modified = true;
            } else if (newTarget.x < sedeMinX) {
              newTarget.x = sedeMinX;
              modified = true;
            }
            if (newTarget.z > sedeMaxZ) {
              newTarget.z = sedeMaxZ;
              modified = true;
            } else if (newTarget.z < sedeMinZ) {
              newTarget.z = sedeMinZ;
              modified = true;
            }
          } else if (this.isTopDownView) {
            if (newTarget.x > topDownMaxX) {
              newTarget.x = topDownMaxX;
              modified = true;
            } else if (newTarget.x < topDownMinX) {
              newTarget.x = topDownMinX;
              modified = true;
            }
            if (newTarget.z > topDownMaxZ) {
              newTarget.z = topDownMaxZ;
              modified = true;
            } else if (newTarget.z < topDownMinZ) {
              newTarget.z = topDownMinZ;
              modified = true;
            }
          } else {
            if (!allowPan) {
              // si no está permitido paneo, centrar X en 0
              if (newTarget.x !== 0) {
                newTarget.x = 0;
                modified = true;
              }
            } else {
              // limitar paneo horizontal dentro de rangos
              if (newTarget.x > maxPanX) {
                newTarget.x = maxPanX;
                modified = true;
              } else if (newTarget.x < minPanX) {
                newTarget.x = minPanX;
                modified = true;
              }
            }
          }

          if (modified) {
            camera.setTarget(newTarget);
          }

          // Evitar que la cámara cruce por debajo del eje de suelo al rotar.
          // Calculamos la altura Y de la cámara a partir del target, radius y beta
          try {
            const minCameraY = 1.5; // distancia mínima segura sobre el suelo (ajustada)
            const camTarget = camera.target;
            const camRadius = camera.radius || 1;
            const camBeta = camera.beta || 0.001;
            const camY = camTarget.y + camRadius * Math.cos(camBeta);

            if (camY < minCameraY) {
              // calcular beta máximo que mantiene camY >= minCameraY
              const ratio = (minCameraY - camTarget.y) / Math.max(0.0001, camRadius);
              const clampedRatio = Math.min(1, Math.max(-1, ratio));
              const allowedBeta = Math.acos(clampedRatio);
              // dejar un pequeño margen para evitar oscilaciones
              const safeAllowedBeta = Math.max(0.05, allowedBeta - 0.03);
              // limitar beta para que la cámara no mire tan bajo
              camera.upperBetaLimit = Math.min(camera.upperBetaLimit ?? Math.PI / 2 - 0.001, safeAllowedBeta);
              const lowerB = camera.lowerBetaLimit ?? 0.01;
              camera.beta = Math.min(Math.max(camera.beta, lowerB), camera.upperBetaLimit);

              // si tras limitar beta la cámara aún queda por debajo, ajustar radius como último recurso
              const camYAfter = camTarget.y + (camera.radius || camRadius) * Math.cos(camera.beta || camBeta);
              if (camYAfter < minCameraY) {
                const neededRadius = Math.abs((minCameraY - camTarget.y) / Math.max(0.0001, Math.cos(camera.beta || camBeta)));
                camera.radius = Math.max(camera.radius || camRadius, neededRadius, this.camera?.lowerRadiusLimit ?? 1);
              }
            }
          } catch (err) {
            // ignore
          }
        } catch (e) {
          // ignore
        }
      });
    }

    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
    light.intensity = 0.45;
    light.diffuse = new BABYLON.Color3(0.65, 0.65, 0.7);
    light.groundColor = new BABYLON.Color3(0.06, 0.06, 0.07);

    const directionalLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-0.5, -1, -0.5), this.scene);
    directionalLight.position = new BABYLON.Vector3(8, 10, 8);
    directionalLight.intensity = 0.8;
    directionalLight.diffuse = new BABYLON.Color3(0.85, 0.85, 0.85);
    directionalLight.specular = new BABYLON.Color3(0.03, 0.03, 0.03);
    directionalLight.shadowEnabled = false;

    this.scene.ambientColor = new BABYLON.Color3(0.01, 0.01, 0.01);
    this.scene.environmentIntensity = 0.04;
    this.scene.imageProcessingConfiguration.contrast = 1.3;
    this.scene.imageProcessingConfiguration.exposure = 0.55;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = false;

    this.createGround();
    this.updateOrthoCamera();
    this.updateZoomButtons();
    this.load3dModel(canvas);

    this.renderLoopFn = () => {
      if (this.scene && this.camera) {
        this.scene.render();
        this.updateBuildingBMarkerPosition(canvas);
      }
    };

    this.engine.runRenderLoop(this.renderLoopFn);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('click', this.onDocumentClick, true);
  }

  private onResize = (): void => {
    if (this.engine) {
      this.engine.resize();
      this.updateOrthoCamera();
    }
  };

  private dispose3d(): void {
    if (this.engine) {
      window.removeEventListener('resize', this.onResize);
      document.removeEventListener('click', this.onDocumentClick, true);
      // remove scene observer if any
      if (this.scene && this.cameraBeforeRenderObserver) {
        try { this.scene.onBeforeRenderObservable.remove(this.cameraBeforeRenderObserver); } catch {}
        this.cameraBeforeRenderObserver = null;
      }
      this.engine.stopRenderLoop();
      this.engine.dispose();
      this.engine = null;
      this.scene = null;
    } else {
      document.removeEventListener('click', this.onDocumentClick, true);
    }
    if (this.renderCanvasContainer?.nativeElement) {
      this.renderCanvasContainer.nativeElement.innerHTML = '';
    }
  }

  private updateOrthoCamera(): void {
    if (!this.camera || !this.engine || this.camera.mode !== BABYLON.Camera.ORTHOGRAPHIC_CAMERA) return;
    const width = this.engine.getRenderWidth();
    const height = this.engine.getRenderHeight();
    const aspect = width / Math.max(height, 1);
    const scale = this.orthoSize;
    this.camera.orthoTop = scale;
    this.camera.orthoBottom = -scale;
    this.camera.orthoRight = scale * aspect;
    this.camera.orthoLeft = -scale * aspect;
  }

  private async load3dModel(canvas: HTMLCanvasElement): Promise<void> {
    if (!this.scene) return;

    const modelName = this.currentFloor;
    const isBuildingB = [this.buildingBFirstFloorModel, this.buildingBSecondFloorModel, this.buildingBThirdFloorModel].includes(modelName);
    const isSede = modelName === this.sedeModel;
    const modelRoot = isSede
      ? '/assets/3d-models/sede/'
      : isBuildingB
        ? '/assets/3d-models/Edificio B/'
        : '/assets/3d-models/Edificio A/';

    // Actualizar el edificio actual
    this.currentBuilding = isSede ? 'S' : (isBuildingB ? 'B' : 'A');

    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        encodeURI(modelRoot),
        encodeURI(modelName),
        this.scene
      );

      const meshes = result.meshes;
      if (meshes.length === 0) return;

      const allNodes = new BABYLON.TransformNode('modelRoot', this.scene);
      // guardar referencia para centrar la cámara mientras el modelo rote
      this.modelRoot = allNodes;
      // Rotar el objeto para que el lado derecho quede al frente (90° en Y para Sede)
      allNodes.rotation = isSede
        ? new BABYLON.Vector3(0, -Math.PI / 2, 0)
        : new BABYLON.Vector3(-Math.PI / 2, Math.PI, 0);

      meshes.forEach((mesh, index) => {
        mesh.isVisible = true;
        mesh.parent = allNodes;
        if (!mesh.material) {
          const defaultMat = new BABYLON.StandardMaterial(`mat_${index}`, this.scene!);
          defaultMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
          mesh.material = defaultMat;
        }
      });

      this.scene.render();

      const bounds = allNodes.getHierarchyBoundingVectors(true);
      const size = BABYLON.Vector3.Distance(bounds.min, bounds.max);
      const targetSize = isSede ? 210 : 25;

      if (size > 0) {
        const scale = targetSize / size;
        allNodes.scaling = new BABYLON.Vector3(scale, scale, scale);
        this.scene.render();

        const scaledBounds = allNodes.getHierarchyBoundingVectors(true);
        const centerX = (scaledBounds.min.x + scaledBounds.max.x) / 2;
        const centerZ = (scaledBounds.min.z + scaledBounds.max.z) / 2;
        allNodes.position.x = -centerX;
        allNodes.position.y = -scaledBounds.min.y;
        allNodes.position.z = -centerZ;

        if (this.camera) {
          this.camera.setTarget(allNodes.position.clone());
          // Actualizar la vista ortográfica después de posicionar el modelo
          this.updateOrthoCamera();
        }
      }

      this.scene.render();

      // Asegurar colisiones entre cámara/texto y los cuerpos visibles
      meshes.forEach((mesh) => {
        if (mesh instanceof BABYLON.AbstractMesh) {
          mesh.checkCollisions = true;
          mesh.isPickable = true;

          const material: any = mesh.material;
          if (material) {
            material.emissiveColor = new BABYLON.Color3(0, 0, 0);
            if ('specularColor' in material) {
              material.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);
            }
            if ('ambientColor' in material) {
              material.ambientColor = new BABYLON.Color3(0.04, 0.04, 0.04);
            }
            if ('metallic' in material) {
              material.metallic = 0;
            }
            if ('roughness' in material) {
              material.roughness = Math.min(1, Math.max(material.roughness ?? 1, 0.85));
            }
            if ('specularPower' in material) {
              material.specularPower = 8;
            }
          }
        }
      });

      // ── Nombres de los cuerpos en consola ─────────────────
      console.log('==== NOMBRES DE CUERPOS ====');
      //meshes.forEach((mesh) => console.log('CUERPO:', mesh.name));




      // ── Click — detectar clic en cuerpo o suelo y imprimir coordenadas ──
      canvas.addEventListener('click', (evt) => {
        if (!this.scene) return;

        const rect = canvas.getBoundingClientRect();
        const pickX = evt.clientX - rect.left;
        const pickY = evt.clientY - rect.top;

        const hits = this.scene.multiPick(pickX, pickY);
        let pickResult: any = null;

        if (hits && hits.length > 0) {
          const objectHit = hits.find(hit => hit.hit && hit.pickedMesh && !this.boundaryNameRegExp.test(hit.pickedMesh.name || ''));
          const fallbackHit = hits.find(hit => hit.hit && hit.pickedMesh);
          pickResult = objectHit || fallbackHit;
        }

        if (pickResult?.hit) {
          const meshName = pickResult.pickedMesh ? pickResult.pickedMesh.name || 'cuerpo' : 'suelo';
          console.log('MESH CLICKEADO:', meshName);
          const normalizedMeshName = (meshName || '').replace(/\s+/g, '').toLowerCase();
          const isFloorTrigger = pickResult.pickedMesh && this.isFloorSelectionTrigger(pickResult.pickedMesh.name);
          const isGroundMesh = pickResult.pickedMesh && pickResult.pickedMesh.name === 'ground';
          const isSedeMesh = isSede || this.currentBuilding === 'S' || normalizedMeshName.includes('untitled') || normalizedMeshName.includes('fixed') || normalizedMeshName.includes('sede');

          if (isSedeMesh && !isGroundMesh) {
            this.closeFloorDialog();
            this.closeDetailPanel();
            if (this.infoBox) this.infoBox.style.display = 'none';
            return;
          }
          console.log('CLICK HANDLER 2 -> meshName:', meshName, '| normalizedMeshName:', normalizedMeshName, '| isFloorTrigger:', isFloorTrigger, '| floorSelectorComponent existe:', !!this.floorSelectorComponent);

          // Si se hace click en la escalera secundaria del primer piso (cuerpo21),
          // abrir el selector de piso y evitar que se muestre el panel lateral izquierdo.
          if ((this.currentFloor === this.firstFloorModel || this.currentFloor === this.buildingBFirstFloorModel)
              && normalizedMeshName === 'cuerpo21') {
            this.floorSelectorComponent?.openDialog();
            this.closeDetailPanel();
            if (this.infoBox) this.infoBox.style.display = 'none';
            return; // prevenir lógica adicional que abriría el panel
          }

          // Cuerpo14 también abre el selector de piso, igual que cuerpo21.
          if ((this.currentFloor === this.firstFloorModel || this.currentFloor === this.buildingBFirstFloorModel)
              && normalizedMeshName.includes('cuerpo14')) {
            this.floorSelectorComponent?.openDialog();
            this.closeDetailPanel();
            if (this.infoBox) this.infoBox.style.display = 'none';
            return;
          }
          const excludedFirstFloorDetailBodies = ['cuerpo14', 'cuerpo21', 'cuerpo19', 'cuerpo25', 'cuerpo45'];
          const excludedSecondFloorDetailBodies = ['cuerpo23', 'cuerpo8', 'cuerpo25', 'cuerpo30', 'cuerpo41'];
          const excludedBuildingBFirstFloorDetailBodies = ['cuerpo0', 'cuerpo97'];
          const excludedBuildingBSecondFloorDetailBodies = ['cuerpo0'];
          const excludedBuildingBThirdFloorDetailBodies = ['cuerpo0'];
          const isFirstFloorBodyDetailTrigger = (this.currentFloor === this.firstFloorModel || this.currentFloor === this.buildingBFirstFloorModel)
            && /^cuerpo/i.test(normalizedMeshName)
            && !excludedFirstFloorDetailBodies.includes(normalizedMeshName)
            && !(this.currentFloor === this.buildingBFirstFloorModel && excludedBuildingBFirstFloorDetailBodies.includes(normalizedMeshName));
          const isSecondFloorBodyDetailTrigger = (this.currentFloor === this.secondFloorModel || this.currentFloor === this.buildingBSecondFloorModel)
            && /^cuerpo/i.test(normalizedMeshName)
            && !excludedSecondFloorDetailBodies.includes(normalizedMeshName)
            && !(this.currentFloor === this.buildingBSecondFloorModel && excludedBuildingBSecondFloorDetailBodies.includes(normalizedMeshName));
          const isThirdFloorBodyDetailTrigger = (this.currentFloor === this.thirdFloorModel || this.currentFloor === this.buildingBThirdFloorModel)
            && /^cuerpo/i.test(normalizedMeshName)
            && !(this.currentFloor === this.buildingBThirdFloorModel && excludedBuildingBThirdFloorDetailBodies.includes(normalizedMeshName));

          if (isFirstFloorBodyDetailTrigger || isSecondFloorBodyDetailTrigger || isThirdFloorBodyDetailTrigger) {
            this.closeFloorDialog();
            this.closeDetailPanel();
            if (this.infoBox) {
              this.infoBox.style.display = 'none';
            }
          } else if (isFloorTrigger) {
            this.floorSelectorComponent?.openDialog();
            this.closeDetailPanel();
            if (this.infoBox) {
              this.infoBox.style.display = 'none';
            }
          } else {
            const isSuppressedLeftPanel =
              (this.currentFloor === this.firstFloorModel || this.currentFloor === this.buildingBFirstFloorModel)
              && excludedFirstFloorDetailBodies.includes(normalizedMeshName);

            if (isSuppressedLeftPanel) {
              this.closeFloorDialog();
              this.closeDetailPanel();
              if (this.infoBox) {
                this.infoBox.style.display = 'none';
              }
            } else {
              this.closeFloorDialog();

              // ── Mostrar infoBox si hay info para el mesh clicado ──
              if (pickResult.pickedMesh && this.infoBox) {
                const info = this.infoData[pickResult.pickedMesh.name];
                if (info) {
                  this.infoBox.innerHTML = `
                    <p style="font-weight:bold;font-size:14px;margin:0 0 4px">${info.nombre}</p>
                    <p style="font-size:12px;color:#555;margin:0">${info.desc}</p>
                  `;
                  this.infoBox.style.display = 'block';
                  this.infoBox.style.left = (evt.clientX + 15) + 'px';
                  this.infoBox.style.top  = (evt.clientY + 15) + 'px';
                } else {
                  this.infoBox.style.display = 'none';
                }
              } else if (this.infoBox) {
                this.infoBox.style.display = 'none';
              }
            }
          }

          // --- DEMO: seleccionar punto A y punto B con dos clics para dibujar ruta ---
        }
      });

    } catch (error) {
      console.error('No se pudo cargar el modelo 3D:', error);
    }
  }

  private createGround(): void {
    if (!this.scene) return;

    const farSize = 220;
    const wallHeight = 16;
    const wallDepth = 0.5;

    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: farSize, height: farSize }, this.scene);
    ground.position.y = 0.01;
    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.38, 0.38, 0.38);
    groundMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    groundMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    groundMat.alpha = 1;
    groundMat.backFaceCulling = true;
    ground.material = groundMat;
    ground.checkCollisions = true;
    ground.isPickable = true;

    const wallMat = new BABYLON.StandardMaterial('wallMat', this.scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.12);
    wallMat.specularColor = new BABYLON.Color3(0, 0, 0);
    wallMat.alpha = 0;
    wallMat.backFaceCulling = false;

    const createWall = (name: string, width: number, height: number): BABYLON.Mesh => {
      const wall = BABYLON.MeshBuilder.CreatePlane(name, { width, height }, this.scene!);
      wall.material = wallMat;
      wall.checkCollisions = true;
      wall.isPickable = true;
      return wall;
    };

    const wallDistance = farSize / 2;
    const northWall = createWall('northWall', farSize, wallHeight);
    northWall.position = new BABYLON.Vector3(0, wallHeight / 2, -wallDistance);

    const southWall = createWall('southWall', farSize, wallHeight);
    southWall.position = new BABYLON.Vector3(0, wallHeight / 2, wallDistance);
    southWall.rotation = new BABYLON.Vector3(0, Math.PI, 0);

    const eastWall = createWall('eastWall', farSize, wallHeight);
    eastWall.position = new BABYLON.Vector3(wallDistance, wallHeight / 2, 0);
    eastWall.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);

    const westWall = createWall('westWall', farSize, wallHeight);
    westWall.position = new BABYLON.Vector3(-wallDistance, wallHeight / 2, 0);
    westWall.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
  }

  onZoomOut(): void {
    this.babylonSceneService.zoomOut();
    if (this.camera && this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      this.orthoSize = Math.min(100, this.orthoSize + 3);
      this.updateOrthoCamera();
    } else if (this.camera) {
      this.camera.radius = Math.min(150, this.camera.radius + 3);
    }
  }

  onResetCamera(): void {
    this.babylonSceneService.resetCamera();
    if (this.camera) {
      this.orthoSize = this.defaultOrthoSize;
      this.camera.setTarget(BABYLON.Vector3.Zero());
      this.updateOrthoCamera();
    }
  }

  onBuildingSelected(building: BuildingId): void {
    if (building === 'B') {
      this.goToBuildingBFirstFloor();
    } else if (building === 'A') {
      this.goToBuildingAFirstFloor();
    } else {
      this.goToSede();
    }
  }

  private setView(mode: '2d' | '3d'): void {
    if (this.viewMode === mode) {
      return;
    }

    if (mode === '3d') {
      if (this.renderCanvasContainer?.nativeElement) {
        this.babylonSceneService.initScene(
          this.renderCanvasContainer.nativeElement,
          (meshName, pickResult) => this.onMeshPicked(meshName, pickResult),
          (markers) => this.onMarkersUpdated(markers)
        );
        this.babylonSceneService.loadModel(this.currentFloor, this.currentBuilding);
      }
    } else {
      this.babylonSceneService.dispose();
    }

    this.viewMode = mode;
  }

  private openFloorDialog(): void {
    this.floorDialogVisible = true;
  }

  private openDetailPanel(title: string, contentHtml: string): void {
    this.isDetailPanelOpen = true;
    this.selectedLocationInfo = {
      nombre: title,
      desc: '',
    };
  }

  private updateZoomButtons(): void {
    // Actualizar estado de botones de zoom si es necesario
  }

  private updateBuildingBMarkerPosition(canvas: HTMLCanvasElement): void {
    // Placeholder para actualizar posición de marcadores en pantalla
  }

  private formatBodyPanelTitle(meshName: string): string {
    const cleaned = meshName.replace(/^cuerpo/i, '').replace(/[_\-]+/g, ' ').trim();
    return cleaned ? `Cuerpo ${cleaned}` : 'Cuerpo';
  }

  closeDetailPanel(): void {
    this.isDetailPanelOpen = false;
    this.selectedLocationInfo = null;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.babylonSceneService.dispose();
  }
}