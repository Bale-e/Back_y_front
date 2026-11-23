import { Injectable, NgZone, OnDestroy } from '@angular/core';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { dibujarFlechaGuia } from './guide-arrow.service';
import { InacapitoGuideService } from './inacapito-guide.service';
import { BuildingId } from '../../core/models/navegacion.model';
import { BuildingRegistryService } from '../../core/services/building-registry.service';

export interface ScreenMarker {
  id: string;
  label: string;
  x: number;
  y: number;
  visible: boolean;
  type: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class BabylonSceneService implements OnDestroy {
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private modelRoot: BABYLON.TransformNode | null = null;
  private destinationMarker: BABYLON.TransformNode | BABYLON.Mesh | null = null;
  private guideArrowMeshes: BABYLON.AbstractMesh[] = [];
  private portalMeshes: BABYLON.AbstractMesh[] = [];
  private portalAnimObserver: BABYLON.Observer<BABYLON.Scene> | null = null;
  private currentRouteAnimId = 0;

  private currentBuilding: BuildingId = 'S';
  private currentFloorModel = 'Instituto3D-color.obj';

  private onMarkersUpdatedCb?: (markers: ScreenMarker[]) => void;

  // Propiedades para rotación continua de presentación y zoom sutil
  private isAutoRotateEnabled = true;
  private isUserInteracting = false;
  private idleTimer: any = null;
  private baseRadius = 210;
  private zoomTime = 0;

  // Zoom in y enfoque de edificios en la Sede
  private buildingFocusAnimId = 0;
  private currentFocusedBuilding: BuildingId | null = null;
  private readonly defaultSedeTarget = new BABYLON.Vector3(0, 0, 0);
  private readonly defaultSedeRadius = 210;
  private readonly buildingFocusRadius = 140;

  // Iluminación y destacado de grupos en el modelo Sede
  private highlightLayer: BABYLON.HighlightLayer | null = null;
  private highlightedBuildingMeshes: BABYLON.AbstractMesh[] = [];
  private highlightPulseObserver: BABYLON.Observer<BABYLON.Scene> | null = null;

  // Entorno urbano y cartográfico 3D (estilo tótem interactivo Parque Arauco)
  private urbanContextRoot: BABYLON.TransformNode | null = null;
  private cartoGround: BABYLON.Mesh | null = null;
  private cartoTexture: BABYLON.DynamicTexture | null = null;

  // Seguimiento de coordenadas para depuración F12
  public lastHoveredCoords: BABYLON.Vector3 | null = null;
  public lastHoveredMeshName = '';
  public lastHoveredCuerpo = '';
  public lastHoveredSala = '';
  private onCoordinatesUpdatedCb?: (data: { coords: BABYLON.Vector3 | null; meshName: string; cuerpo: string; sala: string; building: BuildingId; floor: string }) => void;
  private f12KeyHandler: ((evt: KeyboardEvent) => void) | null = null;

  constructor(
    private ngZone: NgZone,
    private buildingRegistry: BuildingRegistryService,
    private inacapitoGuide: InacapitoGuideService
  ) {}

  public initScene(
    canvasContainer: HTMLDivElement,
    onMeshClicked?: (meshName: string, pickInfo: BABYLON.PickingInfo) => void,
    onMarkersUpdated?: (markers: ScreenMarker[]) => void
  ): void {
    this.dispose();
    this.onMarkersUpdatedCb = onMarkersUpdated;

    const canvas = document.createElement('canvas');
    canvas.className = 'babylon-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.outline = 'none';
    canvasContainer.replaceChildren(canvas);

    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.55, 0.62, 0.70, 1); // Cielo diurno templado que no cansa la vista ni quema los blancos

    this.setupCamera(canvas);
    (window as any).__cam = this.camera; // TEMPORAL, solo para calibrar — borrar después
    this.setupLights();
    this.setupSkybox();
    this.setupUrbanContext();
    this.inacapitoGuide.preloadModel(this.scene);

    this.scene.onPointerDown = (evt, pickResult) => {
      if (evt.button === 0) {
        this.processCoordinatePick(pickResult, this.scene?.pointerX, this.scene?.pointerY, true);

        const pickedMesh = pickResult?.pickedMesh || (this.scene?.pick(this.scene.pointerX, this.scene.pointerY, (m) => m.isVisible && m.name !== 'skyBox')?.pickedMesh);
        const isSede = this.currentBuilding === 'S' || this.isSedeModelName(this.currentFloorModel, this.currentBuilding);
        const building = isSede && pickedMesh ? this.identifyBuildingFromMesh(pickedMesh.name, pickedMesh) : null;

        if (building) {
          // Si se hace click en un edificio de la Sede, no consideramos esto interacción manual que detenga el giro
          this.cancelUserInteraction();
        } else {
          this.registerUserInteraction();
        }

        if (onMeshClicked && pickedMesh) {
          onMeshClicked(pickedMesh.name, pickResult || (this.scene?.pick(this.scene.pointerX, this.scene.pointerY) as any));
        }
      } else {
        this.registerUserInteraction();
      }
    };

    this.scene.onPointerMove = (_evt, pickResult) => {
      this.processCoordinatePick(pickResult, this.scene?.pointerX, this.scene?.pointerY, false);

      const isSede = this.currentBuilding === 'S' || this.isSedeModelName(this.currentFloorModel, this.currentBuilding);
      if (isSede && canvas) {
        if (pickResult.hit && pickResult.pickedMesh && this.identifyBuildingFromMesh(pickResult.pickedMesh.name, pickResult.pickedMesh)) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'default';
        }
      } else if (canvas && canvas.style.cursor === 'pointer') {
        canvas.style.cursor = 'default';
      }
    };

    // Evento F12 global de teclado: cuando el usuario presiona F12 imprime coordenadas completas de inmediato
    this.f12KeyHandler = (evt: KeyboardEvent) => {
      if (evt.key === 'F12' || evt.code === 'F12' || evt.keyCode === 123) {
        this.logCurrentCoordinates('F12 Tecla');
      }
    };
    window.addEventListener('keydown', this.f12KeyHandler);

    this.ngZone.runOutsideAngular(() => {
      this.engine?.runRenderLoop(() => {
        this.scene?.render();
        this.updateScreenMarkers();
        this.handleAutoRotation();
      });
    });

    const resizeHandler = () => this.engine?.resize();
    window.addEventListener('resize', resizeHandler);
  }

  private setupCamera(canvas: HTMLCanvasElement): void {
    if (!this.scene) return;
    const isSede = this.currentBuilding === 'S' || this.isSedeModelName(this.currentFloorModel, this.currentBuilding);
    const bldDef = this.buildingRegistry.getBuilding(this.currentBuilding);
    const initialRadius = isSede ? 210 : (bldDef?.cameraRadius ?? (this.currentBuilding === 'B' ? 36.4 : 28));
    this.camera = new BABYLON.ArcRotateCamera(
      'camera1',
      isSede ? -Math.PI / 2 : (bldDef?.cameraBaseAlpha ?? (Math.PI / 4)),
      isSede ? 1.18 : Math.PI / 3,
      initialRadius,
      new BABYLON.Vector3(0, 0, 0),
      this.scene
    );
    this.camera.lowerRadiusLimit = 2;
    this.camera.upperRadiusLimit = 350;
    this.baseRadius = initialRadius;
    this.camera.attachControl(canvas, true);

    const onInteraction = () => this.registerUserInteraction();
    canvas.addEventListener('pointerdown', onInteraction);
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons > 0) onInteraction();
    });
    canvas.addEventListener('wheel', onInteraction, { passive: true });
    canvas.addEventListener('touchstart', onInteraction, { passive: true });
    canvas.addEventListener('touchmove', onInteraction, { passive: true });
  }

  public registerUserInteraction(): void {
    this.isUserInteracting = true;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.camera) {
      this.baseRadius = this.camera.radius;
    }
    this.idleTimer = setTimeout(() => {
      this.isUserInteracting = false;
      if (this.camera) {
        this.baseRadius = this.camera.radius;
      }
    }, 2500);
  }

  public cancelUserInteraction(): void {
    this.isUserInteracting = false;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.camera) {
      this.camera.inertialAlphaOffset = 0;
      this.camera.inertialBetaOffset = 0;
      this.camera.inertialRadiusOffset = 0;
      this.camera.inertialPanningX = 0;
      this.camera.inertialPanningY = 0;
    }
  }

  private handleAutoRotation(): void {
    if (!this.camera || !this.isAutoRotateEnabled) return;

    const isSede =
      this.currentBuilding === 'S' ||
      this.isSedeModelName(this.currentFloorModel, this.currentBuilding);


    if (!isSede) return;

    const hasInertia =
      Math.abs(this.camera.inertialAlphaOffset) > 0.0001 ||
      Math.abs(this.camera.inertialBetaOffset) > 0.0001 ||
      Math.abs(this.camera.inertialRadiusOffset) > 0.0001 ||
      Math.abs(this.camera.inertialPanningX) > 0.0001 ||
      Math.abs(this.camera.inertialPanningY) > 0.0001;

    // Solo pausar rotación automática si el usuario está manipulando activamente la cámara
    if (this.isUserInteracting || hasInertia) {
      this.baseRadius = this.camera.radius;
      return;
    }

    // Rotación lenta y constante de la cámara (presentación)
    this.camera.alpha += 0.0015;

    // Leves oscilaciones de zoom in y zoom out (efecto respiración suave)
    this.zoomTime += 0.015;
    const zoomOscillation = Math.sin(this.zoomTime * 0.7) * 2.5;

    const minR = this.camera.lowerRadiusLimit ?? 5;
    const maxR = this.camera.upperRadiusLimit ?? 350;
    this.camera.radius = Math.max(minR, Math.min(maxR, this.baseRadius + zoomOscillation));
  }

  private setupLights(): void {
    if (!this.scene) return;
    // 1. Luz hemisférica diurna suave (luz difusa de cielo sin sobreexponer)
    const hemiLight = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 0.65;
    hemiLight.diffuse = new BABYLON.Color3(0.90, 0.92, 0.95);
    hemiLight.groundColor = new BABYLON.Color3(0.35, 0.35, 0.35);

    // 2. Luz solar principal moderada (aporta relieve, sombras y volumen sin quemar blancos)
    const dirLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-0.8, -1.8, -0.7), this.scene);
    dirLight.position = new BABYLON.Vector3(40, 80, 40);
    dirLight.intensity = 0.60;
    dirLight.diffuse = new BABYLON.Color3(1.0, 0.98, 0.94);
    dirLight.specular = new BABYLON.Color3(0.06, 0.06, 0.06);

    // 3. Relleno suave para sombras abiertas
    const fillLight = new BABYLON.DirectionalLight('fillLight', new BABYLON.Vector3(0.8, -1.2, 0.7), this.scene);
    fillLight.position = new BABYLON.Vector3(-40, 60, -40);
    fillLight.intensity = 0.15;
    fillLight.diffuse = new BABYLON.Color3(0.85, 0.88, 0.92);
    fillLight.specular = new BABYLON.Color3(0.02, 0.02, 0.02);
  }

  private setupSkybox(): void {
    if (!this.scene) return;
    const skybox = BABYLON.MeshBuilder.CreateBox('skyBox', { size: 1000.0 }, this.scene);
    const skyboxMaterial = new BABYLON.StandardMaterial('skyBoxMat', this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0.55, 0.62, 0.70);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.emissiveColor = new BABYLON.Color3(0.55, 0.62, 0.70);
    skybox.material = skyboxMaterial;
  }

    /**
   * Genera el entorno cartográfico y arquitectónico 3D alrededor de la Sede INACAP
   * (calles vectoriales, aceras, áreas verdes, señalética urbana y volúmenes 3D contextuales con paralaje).
   */
  private setupUrbanContext(): void {
    if (!this.scene) return;

    if (this.urbanContextRoot) {
      this.urbanContextRoot.dispose(false, true);
      this.urbanContextRoot = null;
    }
    if (this.cartoTexture) {
      this.cartoTexture.dispose();
      this.cartoTexture = null;
    }

    const root = new BABYLON.TransformNode('urbanContextRoot', this.scene);
    this.urbanContextRoot = root;

    // 1. Plano de suelo cartográfico perimetral con vano geométrico real (sin malla bajo el modelo)
    // El vano físico en el centro garantiza que bajo el campus no exista ningún polígono, evitando
    // bases celestes u opacas y dejando el suelo bajo el modelo 100% transparente para ver el piso -1.
    const ground = this.createCartoGroundWithHole(root);

    // Crear DynamicTexture 2048x2048 para dibujo nítido de pavimento gris, calles, veredas y señalética
    const texSize = 2048;
    const dt = new BABYLON.DynamicTexture('cartoDT', { width: texSize, height: texSize }, this.scene, false);
    dt.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    dt.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;

    const ctx = dt.getContext() as CanvasRenderingContext2D;
    this.drawCartographicMap(ctx, texSize, texSize);
    dt.update();

    const groundMat = new BABYLON.StandardMaterial('cartoGroundMat', this.scene);
    groundMat.diffuseTexture = dt;
    groundMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    groundMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
    groundMat.ambientColor = new BABYLON.Color3(0.06, 0.06, 0.06);
    groundMat.backFaceCulling = false;

    ground.material = groundMat;
    this.cartoGround = ground;
    this.cartoTexture = dt;

    // 2. Volúmenes 3D contextuales (edificios vecinos y árboles estilizados con paralaje)
    this.buildContextual3DEnvironment(root);
  }

  /**
   * Construye la malla del suelo exterior con un vano/apertura física reservada exclusivamente
   * para el patio inglés subterráneo (Piso -1) en [-4, 44] x [-39, 2].
   * Al contar con geometría continua a Y=-0.08 en todo el perímetro, el espacio entre el campus
   * y el escenario urbano se viste con pasto verde continuo sin dejar huecos vacíos hacia el skybox.
   */
  private createCartoGroundWithHole(root: BABYLON.TransformNode): BABYLON.Mesh {
    const holeMinX = -4.0;
    const holeMaxX =  44.0;
    const holeMinZ = -39.0;
    const holeMaxZ =   2.0;
    const worldMinX = -200;
    const worldMaxX =  200;
    const worldMinZ = -200;
    const worldMaxZ =  200;

    const quads = [
      { minX: worldMinX, maxX: worldMaxX, minZ: worldMinZ, maxZ: holeMinZ }, // Sur (Av. Bravo de Saravia)
      { minX: worldMinX, maxX: worldMaxX, minZ: holeMaxZ, maxZ: worldMaxZ }, // Norte (Parque posterior)
      { minX: worldMinX, maxX: holeMinX,  minZ: holeMinZ, maxZ: holeMaxZ },  // Poniente (Av. Vicuña Mackenna)
      { minX: holeMaxX,  maxX: worldMaxX, minZ: holeMinZ, maxZ: holeMaxZ },  // Oriente (Pradera oriente)
    ];

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    quads.forEach((q, qIdx) => {
      const baseIdx = qIdx * 4;
      const corners = [
        { x: q.minX, z: q.minZ },
        { x: q.maxX, z: q.minZ },
        { x: q.maxX, z: q.maxZ },
        { x: q.minX, z: q.maxZ },
      ];

      corners.forEach(c => {
        positions.push(c.x, -0.08, c.z);
        normals.push(0, 1, 0);
        const u = (c.x - worldMinX) / (worldMaxX - worldMinX);
        const v = (c.z - worldMinZ) / (worldMaxZ - worldMinZ);
        uvs.push(u, v);
      });

      indices.push(baseIdx, baseIdx + 2, baseIdx + 1);
      indices.push(baseIdx, baseIdx + 3, baseIdx + 2);
    });

    const customMesh = new BABYLON.Mesh('cartoGround', this.scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(customMesh);

    customMesh.parent = root;
    customMesh.isPickable = false;
    customMesh.checkCollisions = false;

    return customMesh;
  }

  /**
   * Dibuja la planimetría urbana vectorial sobre el DynamicTexture con estilo arquitectónico / tótem.
   */
  private drawCartographicMap(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // ── 1. Fondo base de suelo: Mismo gris del suelo del modelo de la sede (#70757d / Color3(0.44, 0.46, 0.49)) ──
    ctx.fillStyle = '#70757d';
    ctx.fillRect(0, 0, w, h);

    // Losas y paños alternados de pavimento / adoquines de hormigón urbano gris
    const slabWidth = 64;
    ctx.fillStyle = '#686d75';
    for (let x = 0; x < w; x += slabWidth * 2) {
      ctx.fillRect(x, 0, slabWidth, h);
    }

    // Trama de juntas de dilatación y modulado de pavimento
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1.5;
    const gridStep = 64;
    for (let x = 0; x < w; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Líneas secundarias sutiles para textura de baldosas de hormigón
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 32; x < w; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 32; y < h; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // ── 2. Av. Bravo de Saravia (Avenida principal frontal frente al acceso) ──
    // Ubicada horizontalmente entre Y=1495 y Y=1675 (180px de ancho)
    ctx.fillStyle = '#282d37'; // Asfalto templado
    ctx.fillRect(0, 1495, w, 180);

    // Bordes de calzada (líneas blancas suaves)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 1500); ctx.lineTo(w, 1500); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 1670); ctx.lineTo(w, 1670); ctx.stroke();

    // Línea central divisoria de pistas (blanca entrecortada)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([32, 22]);
    ctx.beginPath(); ctx.moveTo(0, 1585); ctx.lineTo(w, 1585); ctx.stroke();
    ctx.setLineDash([]); // reset

    // ── 3. Av. Vicuña Mackenna (Avenida lateral) ──
    ctx.fillStyle = '#282d37';
    ctx.fillRect(320, 0, 140, 1500);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(325, 0); ctx.lineTo(325, 1500); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(455, 0); ctx.lineTo(455, 1500); ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([28, 18]);
    ctx.beginPath(); ctx.moveTo(390, 0); ctx.lineTo(390, 1500); ctx.stroke();
    ctx.setLineDash([]);

    // ── 4. Aceras y Concreto de Veredas con bordillos ──
    ctx.fillStyle = '#697180'; // Hormigón claro de vereda diurna
    ctx.fillRect(60, 1450, w - 120, 45); // Vereda norte frente a acceso
    ctx.fillRect(60, 1675, w - 120, 45); // Vereda sur

    // Bordillo / Solera de concreto
    ctx.strokeStyle = '#7d8696';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(60, 1450); ctx.lineTo(w - 60, 1450); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60, 1720); ctx.lineTo(w - 60, 1720); ctx.stroke();

    // Vereda lateral oriente y poniente de Av. Vicuña Mackenna
    ctx.fillRect(460, 100, 30, 1395);
    ctx.fillRect(290, 100, 30, 1395);
    ctx.beginPath(); ctx.moveTo(490, 100); ctx.lineTo(490, 1495); ctx.stroke();

    // ── 5. Paso de Cebra / Cruce Peatonal frente a entrada principal INACAP ──
    const zebraX = 940;
    const zebraW = 95;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
    for (let y = 1510; y < 1665; y += 22) {
      ctx.fillRect(zebraX, y, zebraW, 11);
    }

    // ── 6. Acceso vehicular y zona de estacionamientos frontal ──
    ctx.fillStyle = '#3a404c';
    ctx.fillRect(zebraX - 40, 1380, 175, 70);

    // Bahías y líneas de estacionamiento
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    for (let sx = 620; sx < 890; sx += 34) {
      ctx.beginPath(); ctx.moveTo(sx, 1390); ctx.lineTo(sx, 1445); ctx.stroke();
    }

    // ── 7. Áreas verdes y Pasto perimetral que rellenan el espacio entre el modelo y el escenario ──
    const campusApronX = 490;
    const campusApronY = 560;
    const campusApronW = 1070;
    const campusApronH = 885;

    // Base de césped verde diurno arquitectónico (#386732)
    ctx.fillStyle = '#386732';
    ctx.fillRect(campusApronX, campusApronY, campusApronW, campusApronH);

    // Franjas de corte de césped alternadas estilo parque universitario
    ctx.fillStyle = '#3f7338';
    for (let y = campusApronY; y < campusApronY + campusApronH; y += 44) {
      ctx.fillRect(campusApronX, y, campusApronW, 22);
    }

    // Microtextura orgánica de pasto (briznas y punteado sutil para dar volumen)
    ctx.fillStyle = 'rgba(78, 138, 68, 0.28)';
    for (let x = campusApronX + 4; x < campusApronX + campusApronW; x += 18) {
      for (let y = campusApronY + 4; y < campusApronY + campusApronH; y += 18) {
        const offset = ((x * 19 + y * 31) % 11) - 5;
        ctx.fillRect(x + offset, y + offset, 4, 3);
      }
    }
    ctx.fillStyle = 'rgba(38, 72, 30, 0.22)';
    for (let x = campusApronX + 10; x < campusApronX + campusApronW; x += 22) {
      for (let y = campusApronY + 10; y < campusApronY + campusApronH; y += 22) {
        const offset = ((x * 23 + y * 13) % 9) - 4;
        ctx.fillRect(x + offset, y + offset, 5, 4);
      }
    }

    // Alcorques y canteros ajardinados circulares bajo los árboles del perímetro
    ctx.fillStyle = '#2c251e';
    const treeWorldCoords: Array<{ x: number; z: number }> = [
      { x: -95, z: -84 }, { x: -75, z: -84 }, { x: -55, z: -84 }, { x: -35, z: -84 },
      { x: -15, z: -84 }, { x:   5, z: -84 }, { x:  25, z: -84 }, { x:  45, z: -84 },
      { x:  65, z: -84 }, { x:  85, z: -84 }, { x: 100, z: -84 },
      { x: -118, z: -50 }, { x: -118, z: -20 }, { x: -118, z: 10 }, { x: -118, z: 40 }, { x: -118, z: 70 },
      { x: 118, z: -50 }, { x: 118, z: -20 }, { x: 118, z: 15 }, { x: 118, z: 45 }, { x: 118, z: 75 },
      { x: -75, z: 90 }, { x: -45, z: 92 }, { x: -15, z: 95 }, { x: 15, z: 95 }, { x: 45, z: 92 }, { x: 75, z: 90 }
    ];
    treeWorldCoords.forEach(tc => {
      const u = (tc.x - (-200)) / 400;
      const v = (tc.z - (-200)) / 400;
      const tx = u * w;
      const ty = (1 - v) * h;
      ctx.beginPath();
      ctx.arc(tx, ty, 14, 0, Math.PI * 2);
      ctx.fill();
    });

    // Solera y borde de jardín perimetral hacia las veredas
    ctx.strokeStyle = '#5a6652';
    ctx.lineWidth = 6;
    this.drawRoundedRect(ctx, campusApronX, campusApronY, campusApronW, campusApronH, 12);
    ctx.stroke();

    // Vano en textura que calza exactamente con la apertura física 3D del patio subterráneo (Piso -1)
    const patioHoleX = 1000;
    const patioHoleY = 1010;
    const patioHoleW = 252;
    const patioHoleH = 216;
    ctx.clearRect(patioHoleX, patioHoleY, patioHoleW, patioHoleH);

    // ── 8. Señalética y Badges Vectoriales estilo Tótem ──
    this.drawStreetBadge(ctx, 'AV. BRAVO DE SARAVIA', w / 2, 1585, 0);
    this.drawStreetBadge(ctx, 'AV. VICUÑA MACKENNA', 390, 750, -Math.PI / 2);
    this.drawInfoBadge(ctx, 'ACCESO PRINCIPAL INACAP', zebraX + 48, 1345);
    this.drawBusStopBadge(ctx, 'PARADA PB423 - INACAP', zebraX + 180, 1690);

    // ── 9. Viñeta radial suave para desvanecer los bordes hacia el fondo diurno ──
    const radius = Math.min(w, h) * 0.48;
    const grad = ctx.createRadialGradient(w / 2, h / 2, radius * 0.65, w / 2, h / 2, radius);
    grad.addColorStop(0, 'rgba(140, 160, 179, 0)');
    grad.addColorStop(1, 'rgba(140, 160, 179, 1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  private drawStreetBadge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, angle = 0): void {
    ctx.save();
    ctx.translate(x, y);
    if (angle !== 0) ctx.rotate(angle);

    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const boxW = textWidth + 36;
    const boxH = 36;

    ctx.fillStyle = 'rgba(8, 12, 18, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    this.drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 1);
    ctx.restore();
  }

  private drawInfoBadge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
    ctx.save();
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const boxW = textWidth + 26;
    const boxH = 30;

    ctx.fillStyle = '#c5221f'; // Rojo institucional INACAP
    this.drawRoundedRect(ctx, x - boxW / 2, y - boxH / 2, boxW, boxH, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private drawBusStopBadge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
    ctx.save();
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const boxW = textWidth + 24;
    const boxH = 26;

    ctx.fillStyle = '#2b3544'; // Gris pizarra oscuro neutro (sin azul)
    this.drawRoundedRect(ctx, x - boxW / 2, y - boxH / 2, boxW, boxH, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  /**
   * Construye los volúmenes 3D del entorno urbano (edificios vecinos y arboleda) para lograr
   * profundidad física y paralaje real al rotar la cámara en el tótem interactivo.
   */
  private buildContextual3DEnvironment(root: BABYLON.TransformNode): void {
    if (!this.scene) return;

    // Material de edificios vecinos: gris medio arquitectónico equilibrado
    const neighborMat = new BABYLON.StandardMaterial('ctxNeighborMat', this.scene);
    neighborMat.diffuseColor = new BABYLON.Color3(0.42, 0.44, 0.48);
    neighborMat.emissiveColor = new BABYLON.Color3(0.04, 0.04, 0.05);
    neighborMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

    // Definición de manzanas/edificios vecinos (ancho, profundidad, altura, posX, posY, posZ)
    const buildingsConfig: Array<{ w: number; d: number; h: number; x: number; z: number }> = [
      // Manzana frente a Av. Bravo de Saravia
      { w: 52, d: 36, h: 9.0,  x: -75, z: -130 },
      { w: 42, d: 32, h: 11.5, x: -20, z: -128 },
      { w: 50, d: 38, h: 8.5,  x:  40, z: -132 },
      { w: 38, d: 30, h: 12.0, x:  95, z: -126 },
      // Manzanas laterales a lo largo de Av. Vicuña Mackenna
      { w: 34, d: 58, h: 8.0,  x: -140, z: 20 },
      { w: 36, d: 48, h: 10.0, x: -140, z: 90 },
      // Manzanas posteriores
      { w: 62, d: 34, h: 7.5,  x:  10, z: 128 },
      { w: 48, d: 30, h: 9.0,  x:  78, z: 122 },
    ];

    buildingsConfig.forEach((cfg, idx) => {
      const box = BABYLON.MeshBuilder.CreateBox(`ctx_bld_${idx}`, {
        width: cfg.w,
        depth: cfg.d,
        height: cfg.h
      }, this.scene!);
      box.parent = root;
      box.position = new BABYLON.Vector3(cfg.x, cfg.h / 2, cfg.z);
      box.material = neighborMat;
      box.isPickable = false;
      box.checkCollisions = false;
    });

    // Materiales para árboles volumétricos estilizados diurnos
    const trunkMat = new BABYLON.StandardMaterial('ctxTrunkMat', this.scene);
    trunkMat.diffuseColor = new BABYLON.Color3(0.42, 0.34, 0.26);
    trunkMat.emissiveColor = new BABYLON.Color3(0.08, 0.06, 0.04);

    const foliageMat = new BABYLON.StandardMaterial('ctxFoliageMat', this.scene);
    foliageMat.diffuseColor = new BABYLON.Color3(0.24, 0.44, 0.28);
    foliageMat.emissiveColor = new BABYLON.Color3(0.04, 0.08, 0.05);

    // Plantar árboles volumétricos estilizados (arbolado urbano / alamedas) en el perímetro del campus
    const treeCoords: Array<{ x: number; z: number; d?: number }> = [
      // Hilera frontal a lo largo de Av. Bravo de Saravia (Z = -84)
      { x: -95, z: -84 }, { x: -75, z: -84 }, { x: -55, z: -84 }, { x: -35, z: -84 },
      { x: -15, z: -84 }, { x:   5, z: -84 }, { x:  25, z: -84 }, { x:  45, z: -84 },
      { x:  65, z: -84 }, { x:  85, z: -84 }, { x: 100, z: -84 },
      // Franja poniente (alameda Av. Vicuña Mackenna, X = -118)
      { x: -118, z: -50 }, { x: -118, z: -20 }, { x: -118, z: 10 }, { x: -118, z: 40 }, { x: -118, z: 70 },
      // Alameda oriente (costado oriente del campus, X = 118)
      { x: 118, z: -50 }, { x: 118, z: -20 }, { x: 118, z: 15 }, { x: 118, z: 45 }, { x: 118, z: 75 },
      // Sector norte (parque posterior, Z = 88 a 115)
      { x: -75, z: 90 }, { x: -45, z: 92 }, { x: -15, z: 95 }, { x: 15, z: 95 }, { x: 45, z: 92 }, { x: 75, z: 90 }
    ];

    treeCoords.forEach((tc, idx) => {
      const scaleDiam = tc.d ?? 2.8;
      // Tronco
      const trunk = BABYLON.MeshBuilder.CreateCylinder(`tree_trunk_${idx}`, {
        height: 2.4,
        diameter: 0.35,
        tessellation: 8
      }, this.scene!);
      trunk.parent = root;
      trunk.position = new BABYLON.Vector3(tc.x, 1.2, tc.z);
      trunk.material = trunkMat;
      trunk.isPickable = false;
      trunk.checkCollisions = false;

      // Copa del árbol (geometría facetada estilizada)
      const foliage = BABYLON.MeshBuilder.CreateSphere(`tree_foliage_${idx}`, {
        diameter: scaleDiam,
        segments: 6
      }, this.scene!);
      foliage.parent = root;
      foliage.position = new BABYLON.Vector3(tc.x, 3.2, tc.z);
      foliage.material = foliageMat;
      foliage.isPickable = false;
      foliage.checkCollisions = false;
    });
  }

  /**
   * Muestra u oculta todo el entorno urbano exterior de forma atómica.
   */
  public setUrbanContextVisible(visible: boolean): void {
    if (!this.urbanContextRoot) return;
    this.urbanContextRoot.setEnabled(visible);
  }


  private readonly buildingCentersInSede: Record<string, BABYLON.Vector3> = {
    A: new BABYLON.Vector3(31.2, 6.2, 25.5),
    B: new BABYLON.Vector3(31.9, 6.4, 46.1),
    C: new BABYLON.Vector3(-16.3, 5.1, 54.1),
    D: new BABYLON.Vector3(-41.8, 3.1, 61.5),
    E: new BABYLON.Vector3(-55.0, 3.1, 30.0),
    S: new BABYLON.Vector3(0, 0, 0)
  };

  /**
   * Identifica a qué edificio de la sede pertenece un mesh a partir de su nombre o grupos OBJ.
   */
  public identifyBuildingFromMesh(meshName: string, mesh?: BABYLON.AbstractMesh | null): BuildingId | null {
    const buildingGroup = (mesh?.metadata as any)?.buildingGroup;
    if (buildingGroup) {
      if (/^A$/i.test(buildingGroup)) return 'A';
      if (/^B$/i.test(buildingGroup)) return 'B';
      if (/^C$/i.test(buildingGroup)) return 'C';
      if (/^D$/i.test(buildingGroup)) return 'D';
      if (/^E$/i.test(buildingGroup)) return 'E';
    }
    if (!meshName) return null;
    const normalized = meshName.replace(/[^a-z0-9]/gi, '').toLowerCase();

    // Edificio A: Mesh 121
    if (
      /^(?:a(?=[_\-\s]|_mm|$)|edificio[\s_\-]*a(?=[_\-\s]|$))/i.test(meshName) ||
      normalized === 'a' ||
      normalized.startsWith('amm') ||
      normalized.includes('mesh121') ||
      normalized === '121' ||
      normalized.includes('group67') ||
      normalized.includes('group66') ||
      normalized.includes('edificioa') ||
      normalized.includes('a1')
    ) {
      return 'A';
    }

    // Edificio B: Mesh 159
    if (
      /^(?:b(?=[_\-\s]|_mm|$)|edificio[\s_\-]*b(?=[_\-\s]|$))/i.test(meshName) ||
      normalized === 'b' ||
      normalized.startsWith('bmm') ||
      normalized.includes('mesh159') ||
      normalized === '159' ||
      normalized.includes('group77') ||
      normalized.includes('group70') ||
      normalized.includes('group69') ||
      normalized.includes('edificiob') ||
      normalized.includes('b1')
    ) {
      return 'B';
    }

    // Edificio C: Mesh 168
    if (
      /^(?:c(?=[_\-\s]|_mm|$)|edificio[\s_\-]*c(?=[_\-\s]|$))/i.test(meshName) ||
      normalized === 'c' ||
      normalized.startsWith('cmm') ||
      normalized.includes('mesh168') ||
      normalized === '168' ||
      normalized.includes('group82') ||
      normalized.includes('group81') ||
      normalized.includes('group80') ||
      normalized.includes('edificioc') ||
      normalized.includes('c1')
    ) {
      return 'C';
    }

    // Edificio D: Mesh 65
    if (
      /^(?:d(?=[_\-\s]|_mm|$)|edificio[\s_\-]*d(?=[_\-\s]|$))/i.test(meshName) ||
      normalized === 'd' ||
      normalized.startsWith('dmm') ||
      normalized.includes('mesh65') ||
      normalized === '65' ||
      normalized.includes('group37') ||
      normalized.includes('group36') ||
      normalized.includes('group35') ||
      normalized.includes('edificiod') ||
      normalized.includes('d1')
    ) {
      return 'D';
    }

    // Edificio E
    if (
      /^(?:e(?=[_\-\s]|_mm|$)|edificio[\s_\-]*e(?=[_\-\s]|$))/i.test(meshName) ||
      normalized === 'e' ||
      normalized.startsWith('emm') ||
      normalized.includes('edificioe') ||
      normalized.includes('e1')
    ) {
      return 'E';
    }

    return null;
  }

  /**
   * Obtiene todos los meshes que componen el volumen de un edificio dentro del modelo de la sede.
   */
  public getBuildingMeshesInSede(building: BuildingId, root?: BABYLON.TransformNode | null): BABYLON.AbstractMesh[] {
    const parentNode = root || this.modelRoot;
    if (!parentNode) return [];
    const regex = building === 'A'
      ? /^(?:a(?=[_\-\s]|_mm|$)|edificio[\s_\-]*a(?=[_\-\s]|$))|mesh121|group67|group66|edificioa|a1/i
      : building === 'B'
        ? /^(?:b(?=[_\-\s]|_mm|$)|edificio[\s_\-]*b(?=[_\-\s]|$))|mesh159|group77|group70|group69|edificiob|b1/i
        : building === 'C'
          ? /^(?:c(?=[_\-\s]|_mm|$)|edificio[\s_\-]*c(?=[_\-\s]|$))|mesh168|group82|group81|group80|edificioc|c1/i
          : building === 'D'
            ? /^(?:d(?=[_\-\s]|_mm|$)|edificio[\s_\-]*d(?=[_\-\s]|$))|mesh65|group37|group36|group35|edificiod|d1/i
            : building === 'E'
              ? /^(?:e(?=[_\-\s]|_mm|$)|edificio[\s_\-]*e(?=[_\-\s]|$))|edificioe|e1/i
              : /^$/;

    return parentNode.getChildMeshes(false).filter(m => {
      const meta = (m.metadata as any)?.buildingGroup;
      if (meta && meta.toUpperCase() === building) return true;
      return regex.test(m.name);
    });
  }

  /**
   * Ilumina y destaca con resplandor y contorno el grupo de mallas de un edificio en la Sede,
   * y realiza un zoom in suave hacia el edificio sin detener el giro continuo del escenario.
   * Si building es null, remueve cualquier iluminación y opcionalmente restaura la cámara a la vista general.
   */
  public highlightBuildingInSede(building: BuildingId | null, restoreCamera = true): void {
    this.cancelUserInteraction();

    if (!building) {
      this.currentFocusedBuilding = null;
      this.clearBuildingHighlight();
    this.clearAccessPortals();
      if (restoreCamera) {
        this.animateFocusOnBuildingInSede(null);
      } else {
        this.buildingFocusAnimId++;
      }
      return;
    }

    if (this.currentFocusedBuilding === building && this.highlightedBuildingMeshes.length > 0) {
      return;
    }

    this.currentFocusedBuilding = building;
    this.clearBuildingHighlight();
    this.clearAccessPortals();
    if (!this.modelRoot || !this.scene) return;

    const meshes = this.getBuildingMeshesInSede(building);
    if (meshes.length === 0) return;

    this.highlightedBuildingMeshes = meshes;

    // Color temático distintivo para cada edificio
    const glowColor = building === 'A'
      ? new BABYLON.Color3(1.0, 0.45, 0.08)  // Naranja característico INACAP
      : building === 'B'
        ? new BABYLON.Color3(0.08, 0.75, 1.0) // Cian tecnológico
        : building === 'D'
          ? new BABYLON.Color3(0.85, 0.25, 0.85) // Violeta
          : building === 'E'
            ? new BABYLON.Color3(0.95, 0.75, 0.10) // Ámbar / Dorado
            : new BABYLON.Color3(0.15, 0.88, 0.45); // Verde esmeralda

    // Capa de resplandor (HighlightLayer)
    if (!this.highlightLayer && this.scene) {
      this.highlightLayer = new BABYLON.HighlightLayer('sedeBuildingHighlight', this.scene, {
        mainTextureRatio: 1,
        blurHorizontalSize: 1.5,
        blurVerticalSize: 1.5
      });
      this.highlightLayer.innerGlow = true;
      this.highlightLayer.outerGlow = true;
    }

    for (const mesh of meshes) {
      mesh.renderOverlay = true;
      mesh.overlayColor = glowColor;
      mesh.overlayAlpha = 0.32;
      mesh.renderOutline = true;
      mesh.outlineColor = glowColor;
      mesh.outlineWidth = 0.06;

      if (this.highlightLayer && mesh instanceof BABYLON.Mesh && mesh.getTotalVertices() > 0) {
        this.highlightLayer.addMesh(mesh, glowColor);
      }
    }

    // Efecto sutil de pulso / respiración luminosa mientras el cartel esté activo
    let pulseAngle = 0;
    this.highlightPulseObserver = this.scene.onBeforeRenderObservable.add(() => {
      pulseAngle += 0.05;
      const dynamicAlpha = 0.28 + 0.12 * Math.sin(pulseAngle);
      for (const m of this.highlightedBuildingMeshes) {
        m.overlayAlpha = dynamicAlpha;
      }
    });

    // Pequeño zoom in suave hacia el lugar seleccionado mientras el escenario sigue girando
    this.animateFocusOnBuildingInSede(building);
  }

  /**
   * Realiza una transición suave hacia el edificio seleccionado (zoom in)
   * o restaura la vista general de la Sede (zoom out), manteniendo siempre
   * activa la rotación panorámica continua sin saltos ni cortes.
   */
  private animateFocusOnBuildingInSede(building: BuildingId | null, durationMs = 1000): void {
    if (!this.camera || !this.scene) return;

    const animId = ++this.buildingFocusAnimId;

    const startTarget = this.camera.target.clone();
    const startRadius = this.baseRadius;

    let endTarget: BABYLON.Vector3;
    let endRadius: number;

    if (building) {
      const center = this.getBuildingCenterInSede(this.modelRoot, building);
      endTarget = center.clone();
      endRadius = this.buildingFocusRadius;
    } else {
      endTarget = this.defaultSedeTarget.clone();
      endRadius = this.defaultSedeRadius;
    }

    const startTime = performance.now();

    const step = () => {
      if (animId !== this.buildingFocusAnimId || !this.camera) return;

      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

      this.camera.target = BABYLON.Vector3.Lerp(startTarget, endTarget, eased);
      this.baseRadius = startRadius + (endRadius - startRadius) * eased;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        this.camera.target = endTarget.clone();
        this.baseRadius = endRadius;
      }
    };

    requestAnimationFrame(step);
  }

  /**
   * Apaga la iluminación del edificio seleccionado y restaura el aspecto original.
   */
  public clearBuildingHighlight(): void {
    if (this.highlightPulseObserver && this.scene) {
      this.scene.onBeforeRenderObservable.remove(this.highlightPulseObserver);
      this.highlightPulseObserver = null;
    }

    for (const mesh of this.highlightedBuildingMeshes) {
      mesh.renderOverlay = false;
      mesh.renderOutline = false;
    }
    this.highlightedBuildingMeshes = [];

    if (this.highlightLayer) {
      this.highlightLayer.removeAllMeshes();
    }
  }

  private getBuildingCenterInSede(sedeRoot: BABYLON.TransformNode | null = null, building: BuildingId): BABYLON.Vector3 {
    const regex = building === 'A'
      ? /^(?:a(?=[_\-\s]|_mm|$)|edificio[\s_\-]*a(?=[_\-\s]|$))|mesh121|group67|group66|edificioa|a1/i
      : building === 'B'
        ? /^(?:b(?=[_\-\s]|_mm|$)|edificio[\s_\-]*b(?=[_\-\s]|$))|mesh159|group77|group70|group69|edificiob|b1/i
        : building === 'C'
          ? /^(?:c(?=[_\-\s]|_mm|$)|edificio[\s_\-]*c(?=[_\-\s]|$))|mesh168|group82|group81|group80|edificioc|c1/i
          : building === 'D'
            ? /^(?:d(?=[_\-\s]|_mm|$)|edificio[\s_\-]*d(?=[_\-\s]|$))|mesh65|group37|group36|group35|edificiod|d1/i
            : building === 'E'
              ? /^(?:e(?=[_\-\s]|_mm|$)|edificio[\s_\-]*e(?=[_\-\s]|$))|edificioe|e1/i
              : /^$/;

    const bMeshes = this.getBuildingMeshesInSede(building, sedeRoot || undefined);
    if (bMeshes.length > 0) {
      let bMin = new BABYLON.Vector3(Infinity, Infinity, Infinity);
      let bMax = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
      bMeshes.forEach(m => {
        m.computeWorldMatrix(true);
        const bbox = m.getBoundingInfo().boundingBox;
        bMin = BABYLON.Vector3.Minimize(bMin, bbox.minimumWorld);
        bMax = BABYLON.Vector3.Maximize(bMax, bbox.maximumWorld);
      });
      if (isFinite(bMin.x) && isFinite(bMax.x) && isFinite(bMin.z) && isFinite(bMax.z)) {
        return BABYLON.Vector3.Center(bMin, bMax);
      }
    }

    return this.buildingCentersInSede[building] ? this.buildingCentersInSede[building].clone() : new BABYLON.Vector3(31.2, 11.6, 25.5);
  }

  private async animateTransitionToSede(
    outgoingRoot: BABYLON.TransformNode | null,
    incomingRoot: BABYLON.TransformNode,
    originBuilding: BuildingId
  ): Promise<void> {
    this.buildingFocusAnimId++;
    this.currentFocusedBuilding = null;
    this.clearBuildingHighlight();
    this.clearAccessPortals();
    if (!this.camera || !this.scene) {
      outgoingRoot?.dispose(false, true);
      return;
    }

    const buildingCenter = this.getBuildingCenterInSede(incomingRoot, originBuilding);

    const incomingMeshes = incomingRoot.getChildMeshes(false);
    const outgoingMeshes = outgoingRoot ? outgoingRoot.getChildMeshes(false) : [];

    incomingMeshes.forEach(m => { m.visibility = 0; });
    outgoingMeshes.forEach(m => { m.visibility = 1; });
    this.setUrbanContextVisible(true);

    const startTarget = buildingCenter.clone();
    startTarget.y = 0;

    const startRadius = Math.min(this.camera.radius, 22);
    const endRadius   = 210;

    const startAlpha = this.camera.alpha;
    const startBeta  = this.camera.beta;
    const endAlpha   = -Math.PI / 2;
    const endBeta    = 1.18;
    const endTarget  = BABYLON.Vector3.Zero();

    this.camera.setTarget(startTarget);
    this.camera.radius = startRadius;

    const duration = 1400;
    const startTime = performance.now();

    await new Promise<void>(resolve => {
      const step = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        if (this.camera) {
          this.camera.target = BABYLON.Vector3.Lerp(startTarget, endTarget, eased);
          this.camera.radius = startRadius + (endRadius - startRadius) * eased;
          this.camera.alpha  = startAlpha + (endAlpha - startAlpha) * eased;
          this.camera.beta   = startBeta + (endBeta - startBeta) * eased;
          this.baseRadius    = this.camera.radius;
        }

        const outVis = Math.max(0, 1 - progress * 1.5);
        const inVis  = Math.min(1, progress * 1.3);
        outgoingMeshes.forEach(m => { m.visibility = outVis; });
        incomingMeshes.forEach(m => { m.visibility = inVis; });

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          incomingMeshes.forEach(m => { m.visibility = 1; });
          outgoingRoot?.dispose(false, true);
          this.clearGuideArrows();
          if (this.camera) {
            this.camera.setTarget(endTarget);
            this.camera.radius = endRadius;
            this.camera.alpha  = endAlpha;
            this.camera.beta   = endBeta;
            this.baseRadius    = endRadius;
            this.zoomTime      = 0;
          }
          resolve();
        }
      };

      requestAnimationFrame(step);
    });
  }

  private async animateTransitionFromSede(
    outgoingRoot: BABYLON.TransformNode | null,
    incomingRoot: BABYLON.TransformNode,
    targetBuilding: BuildingId
  ): Promise<void> {
    this.buildingFocusAnimId++;
    this.currentFocusedBuilding = null;
    this.clearBuildingHighlight();
    this.clearAccessPortals();
    if (!this.camera || !this.scene) {
      outgoingRoot?.dispose(false, true);
      return;
    }

    const buildingCenter = outgoingRoot
      ? this.getBuildingCenterInSede(outgoingRoot, targetBuilding)
      : (this.buildingCentersInSede[targetBuilding] || new BABYLON.Vector3(31.2, 11.6, 25.5));

    const bldDef = this.buildingRegistry.getBuilding(targetBuilding);

    const incomingMeshes = incomingRoot.getChildMeshes(false);
    const outgoingMeshes = outgoingRoot ? outgoingRoot.getChildMeshes(false) : [];

    // Ocultar mallas del nuevo piso al inicio
    incomingMeshes.forEach(m => { m.visibility = 0; });
    outgoingMeshes.forEach(m => { m.visibility = 1; });

    // Destacar el edificio seleccionado en la maqueta de la Sede durante el vuelo de aproximación
    const targetBuildingMeshes = this.getBuildingMeshesInSede(targetBuilding, outgoingRoot);
    targetBuildingMeshes.forEach(m => {
      m.renderOverlay = true;
      m.overlayColor = new BABYLON.Color3(0.95, 0.45, 0.10);
      m.overlayAlpha = 0.35;
    });

    const outgoingStartX = outgoingRoot ? outgoingRoot.position.x : 0;
    const outgoingStartY = outgoingRoot ? outgoingRoot.position.y : 0;
    const outgoingStartZ = outgoingRoot ? outgoingRoot.position.z : 0;

    const shiftX = buildingCenter.x;
    const shiftZ = buildingCenter.z;

    const startTarget = this.camera.target.clone();
    const startRadius = this.camera.radius;
    const endRadius   = bldDef?.cameraRadius ?? (targetBuilding === 'B' ? 36.4 : 28);
    const diveRadius  = Math.min(34.0, endRadius + 4.0);

    const startAlpha = this.camera.alpha;
    const startBeta  = this.camera.beta;
    const endAlpha   = bldDef?.cameraBaseAlpha ?? (Math.PI / 4);
    const endBeta    = Math.PI / 3;

    const incomingBaseScale = incomingRoot.scaling.clone();
    const baseIncomingY = incomingRoot.position.y;

    const duration = 1800;
    const P_DIVE = 0.52; // Momento de llegada al edificio exterior e inicio de revelación interior
    const startTime = performance.now();

    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    await new Promise<void>(resolve => {
      const step = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress <= P_DIVE) {
          // ── Fase 1: Vuelo aéreo directo hacia el edificio seleccionado en la Sede ──
          // La maqueta de la sede se alinea suavemente al centro (0, 0, 0) donde se ubicará el piso interior
          const t = easeInOutCubic(progress / P_DIVE);
          if (outgoingRoot && !outgoingRoot.isDisposed()) {
            outgoingRoot.position.x = outgoingStartX - shiftX * t;
            outgoingRoot.position.z = outgoingStartZ - shiftZ * t;
          }
          if (this.camera) {
            // El objetivo de la cámara rastrea el centro del edificio en todo momento
            const curTargetX = buildingCenter.x * (1 - t);
            const curTargetZ = buildingCenter.z * (1 - t);
            this.camera.target = new BABYLON.Vector3(curTargetX, (buildingCenter.y || 0) * (1 - t), curTargetZ);
            this.camera.radius = startRadius + (diveRadius - startRadius) * t;
            this.camera.alpha  = startAlpha + (endAlpha - startAlpha) * t;
            this.camera.beta   = startBeta + (endBeta - startBeta) * t;
            this.baseRadius    = this.camera.radius;
          }
          outgoingMeshes.forEach(m => { if (!m.isDisposed()) m.visibility = 1; });
          incomingMeshes.forEach(m => { if (!m.isDisposed()) m.visibility = 0; });
        } else {
          // ── Fase 2: Inmersión en el edificio — la maqueta exterior se disuelve y revela el piso interior ──
          // El edificio está perfectamente en (0, 0, 0) y el piso interior está exactamente en (0, 0, 0).
          // La cámara permanece anclada al centro (0, 0, 0) frente al modelo, sin desplazarse a espaldas ni lejos.
          const t = easeInOutQuad((progress - P_DIVE) / (1 - P_DIVE));
          if (outgoingRoot && !outgoingRoot.isDisposed()) {
            outgoingRoot.position.x = outgoingStartX - shiftX;
            outgoingRoot.position.z = outgoingStartZ - shiftZ;
          }
          if (this.camera) {
            this.camera.target = BABYLON.Vector3.Zero();
            this.camera.radius = diveRadius + (endRadius - diveRadius) * t;
            this.camera.alpha  = endAlpha;
            this.camera.beta   = endBeta;
            this.baseRadius    = this.camera.radius;
          }

          const outVis = Math.max(0, 1 - t * 1.35);
          const inVis  = Math.min(1, t * 1.35);

          outgoingMeshes.forEach(m => { if (!m.isDisposed()) m.visibility = outVis; });
          incomingMeshes.forEach(m => { if (!m.isDisposed()) m.visibility = inVis; });

          // Expansión suave del piso interior (0.94 -> 1.0) para emerger dentro del volumen del edificio
          const scaleFactor = 0.94 + 0.06 * t;
          if (incomingRoot && !incomingRoot.isDisposed()) {
            incomingRoot.scaling = new BABYLON.Vector3(
              incomingBaseScale.x * scaleFactor,
              incomingBaseScale.y * scaleFactor,
              incomingBaseScale.z * scaleFactor
            );
          }
        }

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          targetBuildingMeshes.forEach(m => { if (!m.isDisposed()) m.renderOverlay = false; });
          incomingMeshes.forEach(m => { if (!m.isDisposed()) m.visibility = 1; });
          if (incomingRoot && !incomingRoot.isDisposed()) {
            incomingRoot.scaling = incomingBaseScale.clone();
            incomingRoot.position.y = baseIncomingY;
          }
          this.setUrbanContextVisible(false);
          outgoingRoot?.dispose(false, true);
          this.clearGuideArrows();
          if (this.camera) {
            this.camera.setTarget(BABYLON.Vector3.Zero());
            this.camera.radius = endRadius;
            this.camera.alpha  = endAlpha;
            this.camera.beta   = endBeta;
            this.baseRadius    = endRadius;
          }
          resolve();
        }
      };

      requestAnimationFrame(step);
    });
  }

  public async loadModel(modelName: string, building: BuildingId | boolean = 'A'): Promise<void> {
    if (!this.scene) return;

    const buildingId: BuildingId = typeof building === 'boolean' ? (building ? 'B' : 'A') : building;

    // Si es el mismo modelo ya cargado, no recargar: conservar escena y cámara intactas.
    const isSameModel = modelName === this.currentFloorModel && buildingId === this.currentBuilding && this.modelRoot !== null;
    if (isSameModel) {
      return;
    }

    this.currentFloorModel = modelName;
    this.currentBuilding = buildingId;
    this.clearBuildingHighlight();
    this.clearAccessPortals();

    if (this.modelRoot) {
      this.modelRoot.dispose(false, true);
      this.modelRoot = null;
    }

    // Disponer cualquier malla previa que no sea skybox o marcador
    this.scene.meshes.slice().forEach(mesh => {
      if (mesh.name !== 'skyBox' && mesh.name !== 'cartoGround' && !mesh.name.startsWith('ctx_') && !mesh.name.startsWith('tree_') && mesh.name !== 'ground' && !mesh.name.startsWith('dest')) {
        mesh.dispose();
      }
    });

    this.clearGuideArrows();
    this.clearDestinationMarker();

    const newRoot = await this.buildModelRoot(modelName, buildingId);
    if (!newRoot) return;

    // Limpiar por si otra llamada asíncrona dejó un modelRoot durante la espera
    if (this.modelRoot) {
      this.modelRoot.dispose(false, true);
    }
    this.modelRoot = newRoot;

    const isSedeCurrent = this.isSedeModelName(modelName, buildingId);
    this.setUrbanContextVisible(isSedeCurrent);

    if (this.camera && this.modelRoot) {
      const isSede = this.isSedeModelName(modelName, buildingId);
      if (isSede) {
        this.camera.setTarget(BABYLON.Vector3.Zero());
        this.camera.radius = 210;
        this.camera.alpha  = -Math.PI / 2;
        this.camera.beta   = 1.18;
        this.baseRadius    = 210;
        this.zoomTime      = 0;
      } else {
        const bldDef = this.buildingRegistry.getBuilding(buildingId);
        this.camera.setTarget(BABYLON.Vector3.Zero());
        this.camera.radius = bldDef?.cameraRadius ?? (buildingId === 'B' ? 36.4 : 28);
        this.baseRadius    = this.camera.radius;
      }
    }

    this.clearAccessPortals();
    if (!isSedeCurrent) {
      this.renderAccessPortals(buildingId, modelName);
    }
  }

  /**
   * Determina si un nombre de modelo corresponde al modelo de la Sede.
   */
  private isSedeModelName(modelName: string, buildingId: BuildingId): boolean {
    return buildingId === 'S' ||
      modelName === 'Instituto3D-color.obj' ||
      modelName.includes('Instituto3D') ||
      modelName === 'INSTITUTO EN 3D.obj' ||
      modelName === 'INSTITUTO CON LETRAS CON BASE FORMATO SKP.obj' ||
      modelName === 'MODELO_INACAP_FIXED.obj';
  }

  /**
   * Carga el archivo OBJ, crea el TransformNode raíz, asigna materiales y ajusta escala/posición.
   * Devuelve el nodo raíz listo para ser posicionado en escena, o null si falla.
   * No toca this.modelRoot ni limpia la escena: es responsabilidad del llamador.
   */
  private async buildModelRoot(modelName: string, buildingId: BuildingId): Promise<BABYLON.TransformNode | null> {
    if (!this.scene) return null;

    const isSede = this.isSedeModelName(modelName, buildingId);
    const bldDef = this.buildingRegistry.getBuilding(buildingId);
    const floorDef = this.buildingRegistry.getFloor(buildingId, modelName);

    let rootUrl = floorDef?.modelDir;
    if (!rootUrl || rootUrl === '/assets/3d-models/') {
      rootUrl = isSede ? '/assets/3d-models/sede/' : `/assets/3d-models/Edificio ${buildingId}/`;
    }

    let result: BABYLON.ISceneLoaderAsyncResult;
    try {
      result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        encodeURI(rootUrl),
        encodeURI(modelName),
        this.scene
      );
    } catch (err) {
      console.error(`Error al cargar modelo 3D (${rootUrl}${modelName}):`, err);
      return null;
    }

    if (!result || result.meshes.length === 0) return null;

    const allNodes = new BABYLON.TransformNode('modelRoot', this.scene);

    if (bldDef) {
      allNodes.rotation = new BABYLON.Vector3(bldDef.rotation.x, bldDef.rotation.y, bldDef.rotation.z);
      if (bldDef.scale) {
        allNodes.scaling = new BABYLON.Vector3(bldDef.scale.x, bldDef.scale.y, bldDef.scale.z);
      }
    } else {
      allNodes.rotation = isSede
        ? new BABYLON.Vector3(0, -Math.PI / 2, 0)
        : new BABYLON.Vector3(-Math.PI / 2, Math.PI, 0);
    }

    let currentGroupName = '';
    let subIndex = 0;
    result.meshes.forEach((mesh, index) => {
      mesh.isVisible = true;
      mesh.parent = allNodes;
      mesh.isPickable = true;
      mesh.checkCollisions = true;

      if (isSede) {
        if (mesh.name && !mesh.name.startsWith('mesh_mm') && mesh.name !== 'default') {
          currentGroupName = mesh.name;
          subIndex = 0;
        } else if (currentGroupName) {
          subIndex++;
          mesh.name = `${currentGroupName}_mm${subIndex}`;
        }
        mesh.metadata = { ...(mesh.metadata || {}), buildingGroup: currentGroupName };
      }

      // 1. Ocultar la base sólida de la maqueta de SketchUp (53 caras que encajonan de Y=-2832 a Y=+52)
      // para que no encajone el nivel subterráneo ni tape el patio inferior desde vistas laterales
      const isBaseMaqueta =
        mesh.name.toLowerCase().includes('base_maqueta') ||
        (mesh.material && (mesh.material as any).name?.toLowerCase().includes('base_maqueta'));

      if (isBaseMaqueta) {
        mesh.isVisible = false;
        mesh.visibility = 0;
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        return;
      }

      // 2. Suelo del campus ("Piso"): visible en gris pavimento arquitectónico neutro (Color3(0.40, 0.40, 0.40))
      // Las 253 caras superiores que tapaban el patio inglés del piso -1 han sido retiradas de la geometría,
      // permitiendo ver el piso -1 al aire libre mientras el suelo del campus es plenamente visible en gris.
      const isPisoMesh =
        currentGroupName.toLowerCase() === 'piso' ||
        mesh.name.toLowerCase().startsWith('piso');

      if (isSede && isPisoMesh) {
        mesh.isVisible = true;
        mesh.visibility = 1;
        mesh.isPickable = false;
        mesh.checkCollisions = false;

        const pisoMat = new BABYLON.StandardMaterial(`sedePisoMat_${index}`, this.scene!);
        pisoMat.diffuseColor = new BABYLON.Color3(0.44, 0.46, 0.49); // Gris pavimento equilibrado
        pisoMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
        pisoMat.ambientColor = new BABYLON.Color3(0.06, 0.06, 0.06);
        pisoMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
        pisoMat.backFaceCulling = false;
        mesh.material = pisoMat;
        return;
      }

      if (!mesh.material) {
        const defaultMat = new BABYLON.StandardMaterial(`defaultMat_${index}`, this.scene!);
        defaultMat.diffuseColor = new BABYLON.Color3(0.50, 0.50, 0.50);
        mesh.material = defaultMat;
      }

      const material: any = mesh.material;
      if (material) {
        const matName = (material.name || '').toLowerCase();
        // Garantizar que todo el suelo del nivel 1 (interiores, exteriores, canchas y patios) sea gris pavimento diurno equilibrado
        if (isSede && (matName.includes('piso') || matName.includes('suelo') || matName.includes('pavimento') || matName.includes('hormigon'))) {
          material.diffuseColor = new BABYLON.Color3(0.44, 0.46, 0.49); // Mismo gris pavimento sede
        }
        if (isSede && (matName.includes('cancha_azul') || matName.includes('cancha_coral'))) {
          material.diffuseColor = new BABYLON.Color3(0.40, 0.42, 0.45); // Gris pavimento deportivo
        }
        if (isSede && matName.includes('patio_menta')) {
          material.diffuseColor = new BABYLON.Color3(0.44, 0.46, 0.49); // Gris pavimento patio
        }
        if (isSede && matName.includes('vidrio_turquesa')) {
          material.diffuseColor = new BABYLON.Color3(0.28, 0.32, 0.36); // Acristalamiento antirreflejo
        }

        material.emissiveColor = new BABYLON.Color3(0, 0, 0);
        if ('specularColor' in material) material.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);
        if ('ambientColor'  in material) material.ambientColor  = new BABYLON.Color3(0.06, 0.06, 0.06);
        if ('metallic'      in material) material.metallic      = 0;
        if ('roughness'     in material) material.roughness     = Math.min(1, Math.max(material.roughness ?? 1, 0.90));
        if ('specularPower' in material) material.specularPower = 8;
        material.backFaceCulling = false;
      }
    });

    // Ajustar escala y centrar
    const bounds     = allNodes.getHierarchyBoundingVectors(true);
    const size       = BABYLON.Vector3.Distance(bounds.min, bounds.max);
    const targetSize = isSede ? 210 : 25;

    if (size > 0) {
      const scale = targetSize / size;
      allNodes.scaling = new BABYLON.Vector3(scale, scale, scale);

      const scaledBounds = allNodes.getHierarchyBoundingVectors(true);
      const centerX = (scaledBounds.min.x + scaledBounds.max.x) / 2;
      const centerZ = (scaledBounds.min.z + scaledBounds.max.z) / 2;

      allNodes.position.x = -centerX;
      // En la Sede, el punto más bajo (scaledBounds.min.y) corresponde al subterráneo (Piso -1 / Patio Inferior).
      // El nivel de suelo real de la calle y accesos está en Y=52.4 (raw).
      // Alineamos Y para que el nivel de suelo del campus quede en Y=0.0 sobre la calle,
      // evitando que el edificio flote 5 metros en el aire mientras Piso -1 queda bajo tierra.
      allNodes.position.y = isSede ? -(52.4 * scale) : -scaledBounds.min.y;
      allNodes.position.z = -centerZ;
    }

    return allNodes;
  }

  /**
   * Cambia de modelo con animación fluida y continua de deslizamiento vertical que da
   * la sensación orgánica de subir o bajar un piso, desvaneciendo suavemente el piso
   * saliente mientras el nuevo se posiciona armónicamente.
   *
   * @param modelName   Nombre del archivo .obj del nuevo piso.
   * @param building    Edificio destino.
   * @param direction   'up'   → nuevo piso entra desde arriba, el actual sale hacia abajo.
   *                    'down' → nuevo piso entra desde abajo, el actual sale hacia arriba.
   */
  public async loadModelWithTransition(
    modelName: string,
    building: BuildingId | boolean = 'A',
    direction: 'up' | 'down' | 'left' | 'right' | 'lateral-right' | 'lateral-left' = 'up',
    connectorOut?: { x: number; y: number; z: number },
    connectorIn?: { x: number; y: number; z: number }
  ): Promise<void> {
    if (!this.scene) return;

    const buildingId: BuildingId = typeof building === 'boolean' ? (building ? 'B' : 'A') : building;

    const isSameModel = modelName === this.currentFloorModel && buildingId === this.currentBuilding && this.modelRoot !== null;
    if (isSameModel) return;

    // Capturar el estado ANTERIOR antes de sobrescribir
    const prevBuilding = this.currentBuilding;
    const prevFloor    = this.currentFloorModel;
    const isSede  = this.isSedeModelName(modelName, buildingId);
    const wasSede = this.isSedeModelName(prevFloor, prevBuilding);

    this.currentFloorModel = modelName;
    this.currentBuilding   = buildingId;
    this.clearBuildingHighlight();
    this.clearAccessPortals();

    this.clearDestinationMarker();

    // El modelo saliente se conserva vivo durante la animación
    const outgoingRoot = this.modelRoot;
    this.modelRoot = null;

    // Cargar el nuevo modelo (centrado, materiales aplicados)
    const incomingRoot = await this.buildModelRoot(modelName, buildingId);
    if (!incomingRoot) {
      outgoingRoot?.dispose(false, true);
      this.clearGuideArrows();
      return;
    }

    if (this.modelRoot && this.modelRoot !== incomingRoot) {
      this.modelRoot.dispose(false, true);
    }
    this.modelRoot = incomingRoot;

    // ── Ocultar el escenario urbano al entrar a pisos interiores ──
    this.setUrbanContextVisible(isSede);

    // ── Transición especial hacia la SEDE (Zoom-out desde el edificio de origen) ──
    if (isSede && !wasSede && (prevBuilding === 'A' || prevBuilding === 'B' || prevBuilding === 'C' || prevBuilding === 'D' || prevBuilding === 'E')) {
      await this.animateTransitionToSede(outgoingRoot, incomingRoot, prevBuilding);
      return;
    }

    // ── Transición especial desde la SEDE hacia un edificio (Zoom-in hacia el pasillo) ──
    if (wasSede && !isSede && (buildingId === 'A' || buildingId === 'B' || buildingId === 'C' || buildingId === 'D' || buildingId === 'E')) {
      await this.animateTransitionFromSede(outgoingRoot, incomingRoot, buildingId);
      return;
    }

    // ── Preparar animación: Unión por Punto de Conexión o Elevador Vertical ──
    const isLateral = direction === 'left' || direction === 'right' || direction === 'lateral-right' || direction === 'lateral-left';

    const OFFSET_Y = 26;
    const GAP_Y    = 4.2;

    const incomingBaseY = incomingRoot.position.y;
    const outgoingBaseY = outgoingRoot ? outgoingRoot.position.y : 0;
    const incomingBaseX = incomingRoot.position.x;
    const outgoingBaseX = outgoingRoot ? outgoingRoot.position.x : 0;
    const incomingBaseZ = incomingRoot.position.z;
    const outgoingBaseZ = outgoingRoot ? outgoingRoot.position.z : 0;

    // Dirección física entre los edificios basada en el registro del campus
    let dirX = 1;
    let dirZ = 0;

    if (isLateral) {
      const bldPrev = this.buildingRegistry.getBuilding(prevBuilding);
      const bldNext = this.buildingRegistry.getBuilding(buildingId);

      if (bldPrev && bldNext && prevBuilding !== buildingId) {
        const rawDx = bldNext.center.x - bldPrev.center.x;
        const rawDz = bldNext.center.z - bldPrev.center.z;
        const rawDist = Math.hypot(rawDx, rawDz);
        if (rawDist > 1.0) {
          dirX = rawDx / rawDist;
          dirZ = rawDz / rawDist;
        }
      } else if (connectorOut && connectorIn) {
        const rawDx = connectorOut.x - connectorIn.x;
        const rawDz = connectorOut.z - connectorIn.z;
        const rawDist = Math.hypot(rawDx, rawDz);
        if (rawDist > 0.1) {
          dirX = rawDx / rawDist;
          dirZ = rawDz / rawDist;
        }
      } else {
        const sign = (direction === 'right' || direction === 'lateral-right') ? 1 : -1;
        dirX = sign;
        dirZ = 0;
      }
    }

    // Separación física estricta entre centros de edificios para evitar cualquier solapamiento
    // Cada edificio tiene un radio envolvente de ~13-14 unidades; con 36 unidades de separación
    // los volúmenes 3D nunca se intersectan y se alinean limpiamente lado a lado.
    const TARGET_SEPARATION = 36.0;
    const EXTRA_APPROACH    = 24.0;

    // Posición acoplada al lado del edificio actual (sin superposición)
    const dockX = incomingBaseX + dirX * TARGET_SEPARATION;
    const dockZ = incomingBaseZ + dirZ * TARGET_SEPARATION;

    // Posición inicial exterior desde donde se desplaza el nuevo mapa hacia adentro
    const startX = dockX + dirX * EXTRA_APPROACH;
    const startZ = dockZ + dirZ * EXTRA_APPROACH;

    // Destino exterior hacia donde el nuevo modelo empuja al edificio saliente
    const exitX = outgoingBaseX - dirX * (TARGET_SEPARATION + EXTRA_APPROACH);
    const exitZ = outgoingBaseZ - dirZ * (TARGET_SEPARATION + EXTRA_APPROACH);

    let incomingStartY = incomingBaseY;
    let meetY = incomingBaseY;
    let outgoingExitY = outgoingBaseY;

    if (isLateral) {
      incomingRoot.position.x = startX;
      incomingRoot.position.z = startZ;
      incomingRoot.position.y = incomingBaseY;
    } else {
      incomingStartY = direction === 'up' ? incomingBaseY + OFFSET_Y : incomingBaseY - OFFSET_Y;
      meetY          = direction === 'up' ? outgoingBaseY + GAP_Y   : outgoingBaseY - GAP_Y;
      outgoingExitY  = direction === 'up' ? outgoingBaseY - OFFSET_Y : outgoingBaseY + OFFSET_Y;

      incomingRoot.position.x = incomingBaseX;
      incomingRoot.position.z = incomingBaseZ;
      incomingRoot.position.y = incomingStartY;
    }

    const incomingMeshes = incomingRoot.getChildMeshes(false);
    const outgoingMeshes = outgoingRoot ? outgoingRoot.getChildMeshes(false) : [];
    const arrowMeshes    = this.guideArrowMeshes.slice();

    incomingMeshes.forEach(m => { m.visibility = 0; });

    // ── Animación en 3 etapas: Deslizar desde fuera -> Encajar -> Desplazar modelo anterior ──
    const DURATION_MS = 2400;
    const P1 = 0.40; // fin de etapa 1 (~960ms): Deslizarse desde fuera y acoplarse lado a lado
    const P2 = 0.48; // fin de etapa 2 (~1152ms, micro-pausa de contacto en el umbral)

    const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
    const easeInOutQuad = (t: number): number =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const startTime = performance.now();

    await new Promise<void>(resolve => {
      const step = () => {
        const elapsed = performance.now() - startTime;
        const raw     = Math.min(elapsed / DURATION_MS, 1);

        let incomingX: number;
        let incomingZ: number;
        let outgoingX: number;
        let outgoingZ: number;
        let incomingY: number;
        let outgoingY: number;
        let incomingAlpha: number;
        let outgoingAlpha: number;

        if (isLateral) {
          if (raw <= P1) {
            // Fase 1: Desplazarse desde fuera hacia el punto de conexión hasta encajar
            const t = easeOutCubic(raw / P1);
            incomingX     = startX + (dockX - startX) * t;
            incomingZ     = startZ + (dockZ - startZ) * t;
            incomingY     = incomingBaseY;
            outgoingX     = outgoingBaseX;
            outgoingZ     = outgoingBaseZ;
            outgoingY     = outgoingBaseY;
            incomingAlpha = Math.min(1, t * 2.2);
            outgoingAlpha = 1;
          } else if (raw <= P2) {
            // Fase 2: Micro-pausa de encaje en el umbral
            incomingX     = dockX;
            incomingZ     = dockZ;
            incomingY     = incomingBaseY;
            outgoingX     = outgoingBaseX;
            outgoingZ     = outgoingBaseZ;
            outgoingY     = outgoingBaseY;
            incomingAlpha = 1;
            outgoingAlpha = 1;
          } else {
            // Fase 3: Desplazamiento simultáneo (el nuevo avanza al centro y empuja al anterior hacia afuera)
            const localProgress = (raw - P2) / (1 - P2);
            const tDisplace     = easeInOutQuad(localProgress);

            incomingX     = dockX + (incomingBaseX - dockX) * tDisplace;
            incomingZ     = dockZ + (incomingBaseZ - dockZ) * tDisplace;
            incomingY     = incomingBaseY;

            outgoingX     = outgoingBaseX + (exitX - outgoingBaseX) * tDisplace;
            outgoingZ     = outgoingBaseZ + (exitZ - outgoingBaseZ) * tDisplace;
            outgoingY     = outgoingBaseY;

            incomingAlpha = 1;
            outgoingAlpha = Math.max(0, 1 - localProgress * 1.35);
          }
        } else {
          // Transición vertical de pisos (mismo edificio)
          if (raw <= P1) {
            const t = easeOutCubic(raw / P1);
            incomingX     = incomingBaseX;
            incomingZ     = incomingBaseZ;
            incomingY     = incomingStartY + (meetY - incomingStartY) * t;
            outgoingX     = outgoingBaseX;
            outgoingZ     = outgoingBaseZ;
            outgoingY     = outgoingBaseY;
            incomingAlpha = Math.min(1, t * 1.25);
            outgoingAlpha = 1;
          } else if (raw <= P2) {
            incomingX     = incomingBaseX;
            incomingZ     = incomingBaseZ;
            incomingY     = meetY;
            outgoingX     = outgoingBaseX;
            outgoingZ     = outgoingBaseZ;
            outgoingY     = outgoingBaseY;
            incomingAlpha = 1;
            outgoingAlpha = 1;
          } else {
            const localProgress = (raw - P2) / (1 - P2);
            const tExit         = easeInOutQuad(localProgress);

            incomingX     = incomingBaseX;
            incomingZ     = incomingBaseZ;
            incomingY     = meetY + (incomingBaseY - meetY) * localProgress;
            outgoingX     = outgoingBaseX;
            outgoingZ     = outgoingBaseZ;
            outgoingY     = outgoingBaseY + (outgoingExitY - outgoingBaseY) * tExit;
            incomingAlpha = 1;
            outgoingAlpha = Math.max(0, 1 - localProgress);
          }
        }

        if (incomingRoot && !incomingRoot.isDisposed()) {
          incomingRoot.position.x = incomingX;
          incomingRoot.position.y = incomingY;
          incomingRoot.position.z = incomingZ;
        }
        if (outgoingRoot && !outgoingRoot.isDisposed()) {
          outgoingRoot.position.x = outgoingX;
          outgoingRoot.position.y = outgoingY;
          outgoingRoot.position.z = outgoingZ;
        }

        incomingMeshes.forEach(m => { if (!m.isDisposed()) m.visibility = incomingAlpha; });
        outgoingMeshes.forEach(m => { if (!m.isDisposed()) m.visibility = outgoingAlpha; });
        arrowMeshes.forEach(m => { if (!m.isDisposed()) m.visibility = outgoingAlpha; });

        if (raw < 1) {
          requestAnimationFrame(step);
        } else {
          // Finalizar transición en el estado exacto
          if (incomingRoot && !incomingRoot.isDisposed()) {
            incomingRoot.position.x = incomingBaseX;
            incomingRoot.position.y = incomingBaseY;
            incomingRoot.position.z = incomingBaseZ;
            incomingRoot.getChildMeshes(false).forEach(m => { m.visibility = 1; });
          }
          this.clearGuideArrows();
          outgoingRoot?.dispose(false, true);
          resolve();
        }
      };

      requestAnimationFrame(step);
    });

    // ── Recentrar cámara al modelo de piso interior tras la animación ────────
    if (this.camera) {
      if (isSede) {
        this.camera.setTarget(BABYLON.Vector3.Zero());
        this.camera.radius = 210;
        this.camera.alpha  = -Math.PI / 2;
        this.camera.beta   = 1.18;
        this.baseRadius    = 210;
        this.zoomTime      = 0;
      } else {
        const bldDef = this.buildingRegistry.getBuilding(buildingId);
        this.camera.setTarget(BABYLON.Vector3.Zero());
        this.camera.radius = bldDef?.cameraRadius ?? (buildingId === 'B' ? 36.4 : 28);
        this.camera.alpha  = bldDef?.cameraBaseAlpha ?? (Math.PI / 4);
        this.camera.beta   = Math.PI / 3;
        this.baseRadius    = this.camera.radius;
      }
    }

    this.clearAccessPortals();
    if (!isSede) {
      this.renderAccessPortals(buildingId, modelName);
    }
  }

  private updateScreenMarkers(): void {
    if (!this.scene || !this.camera || !this.engine || !this.onMarkersUpdatedCb) return;

    const markers: ScreenMarker[] = [];
    const viewMatrix = this.camera.getViewMatrix();
    const projectionMatrix = this.camera.getProjectionMatrix();
    const transformMatrix = viewMatrix.multiply(projectionMatrix);
    const viewport = new BABYLON.Viewport(0, 0, this.engine.getRenderWidth(), this.engine.getRenderHeight());

    // Proyecta un punto LOCAL (antes de aplicar la rotación del modelRoot), ajustando su Y al suelo real
    const projectPointOnGround = (
      localX: number,
      localZ: number,
      heightOffset = 0.05
    ): { x: number; y: number; visible: boolean } => {
      const localPos = new BABYLON.Vector3(localX, 0, localZ);

      const worldPos = this.modelRoot
        ? BABYLON.Vector3.TransformCoordinates(localPos, this.modelRoot.getWorldMatrix())
        : localPos;

      let groundY = worldPos.y;
      try {
        const rayOrigin = new BABYLON.Vector3(worldPos.x, 50, worldPos.z);
        const ray = new BABYLON.Ray(rayOrigin, BABYLON.Vector3.Down(), 200);
        const pickInfo = this.scene ? this.scene.pickWithRay(ray) : null;
        if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
          groundY = pickInfo.pickedPoint.y;
        }
      } catch (e) {
        // si falla el raycast, mantener worldPos.y como fallback
      }

      const adjustedWorldPos = new BABYLON.Vector3(worldPos.x, groundY + heightOffset, worldPos.z);

      const screenCoords = BABYLON.Vector3.Project(
        adjustedWorldPos,
        BABYLON.Matrix.Identity(),
        transformMatrix,
        viewport
      );

      const isVisible =
        screenCoords.z > 0 &&
        screenCoords.z < 1 &&
        screenCoords.x > 0 &&
        screenCoords.x < this.engine!.getRenderWidth() &&
        screenCoords.y > 0 &&
        screenCoords.y < this.engine!.getRenderHeight();

      return { x: screenCoords.x, y: screenCoords.y, visible: isVisible };
    };

    // Proyecta un punto que YA está en espacio de mundo (ej. coordenadas capturadas por clic)
    const projectWorldPointOnGround = (
      worldX: number,
      worldZ: number,
      heightOffset = 0.05,
      fixedY?: number
    ): { x: number; y: number; visible: boolean } => {
      let groundY = fixedY !== undefined ? fixedY : 0;
      if (fixedY === undefined) {
        try {
          const rayOrigin = new BABYLON.Vector3(worldX, 50, worldZ);
          const ray = new BABYLON.Ray(rayOrigin, BABYLON.Vector3.Down(), 200);
          const pickInfo = this.scene ? this.scene.pickWithRay(ray) : null;
          if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
            groundY = pickInfo.pickedPoint.y;
          }
        } catch (e) {
          // si falla el raycast, mantener groundY en 0
        }
      }

      const adjustedWorldPos = new BABYLON.Vector3(worldX, groundY + heightOffset, worldZ);

      const screenCoords = BABYLON.Vector3.Project(
        adjustedWorldPos,
        BABYLON.Matrix.Identity(),
        transformMatrix,
        viewport
      );

      const isVisible =
        screenCoords.z > 0 &&
        screenCoords.z < 1 &&
        screenCoords.x > 0 &&
        screenCoords.x < this.engine!.getRenderWidth() &&
        screenCoords.y > 0 &&
        screenCoords.y < this.engine!.getRenderHeight();

      return { x: screenCoords.x, y: screenCoords.y, visible: isVisible };
    };

    // Marcador Edificio B (desde Edificio A)
    if (this.currentBuilding === 'A') {
      const proj = projectWorldPointOnGround(11.375700555221513, -0.02395946437413432);
      markers.push({
        id: 'marker-building-b',
        label: '→ Ir al Edificio B',
        x: proj.x,
        y: proj.y,
        visible: proj.visible,
        type: 'building-b'
      });

      if (this.currentFloorModel.includes('Piso 1')) {
        const proj2 = projectWorldPointOnGround(-9.697827490499874, -0.2551487650904001);
        markers.push({
          id: 'marker-sede',
          label: '→ Ir a Sede Renca',
          x: proj2.x,
          y: proj2.y,
          visible: proj2.visible,
          type: 'sede'
        });
      }
    }

    // Marcador Edificio A (desde Edificio B)
    if (this.currentBuilding === 'B') {
      const isBuildingBThirdFloor = this.currentFloorModel === 'Edificio B - Piso 3.obj';
      const proj = isBuildingBThirdFloor
        ? projectWorldPointOnGround(-0.1150672957515404, -8.696399910085567)
        : projectWorldPointOnGround(-5.336930000984566, -1.9430948868138938);
      markers.push({
        id: 'marker-building-a',
        label: '← Volver al Edificio A',
        x: proj.x,
        y: proj.y,
        visible: proj.visible,
        type: 'building-a'
      });
    }

    // Marcador Sede (desde Edificio C)
    if (this.currentBuilding === 'C') {
      const proj = projectWorldPointOnGround(4.407557547931399, 9.68820615481936);
      markers.push({
        id: 'marker-sede',
        label: '→ Ir a Sede Renca',
        x: proj.x,
        y: proj.y,
        visible: proj.visible,
        type: 'sede'
      });

      // Marcador Edificio D (desde Edificio C Piso 1)
      if (this.currentFloorModel.includes('Piso 1')) {
        const projD = projectWorldPointOnGround(-3.0816219995085463, -5.523080245355527);
        markers.push({
          id: 'marker-building-d',
          label: '→ Ir al Edificio D',
          x: projD.x,
          y: projD.y,
          visible: projD.visible,
          type: 'building-d'
        });

        // Marcador Edificio E (desde Edificio C Piso 1)
        const projE = projectWorldPointOnGround(-3.160340012066989, 1.6463125327081438, 0.05, 0.1469096839427877);
        markers.push({
          id: 'marker-building-e',
          label: '→ Ir al Edificio E',
          x: projE.x,
          y: projE.y,
          visible: projE.visible,
          type: 'building-e'
        });
      }
    }

    // Marcador Edificio C y Sede (desde Edificio E)
    if (this.currentBuilding === 'E') {
      const projC = projectWorldPointOnGround(-10.257817831379821, 0.5507832656850731, 0.05, 0.28873252858175036);
      markers.push({
        id: 'marker-building-c',
        label: '→ Ir para el Edificio C',
        x: projC.x,
        y: projC.y,
        visible: projC.visible,
        type: 'building-c'
      });

      const proj = projectWorldPointOnGround(0, 0);
      markers.push({
        id: 'marker-sede',
        label: '→ Ir a Sede Renca',
        x: proj.x,
        y: proj.y,
        visible: proj.visible,
        type: 'sede'
      });
    }

    // Marcador Sede y Edificio C (desde Edificio D)
    if (this.currentBuilding === 'D') {
      const proj = projectWorldPointOnGround(-0.11450809982627064, -11.112192515863468);
      markers.push({
        id: 'marker-sede',
        label: '→ Ir a Sede Renca',
        x: proj.x,
        y: proj.y,
        visible: proj.visible,
        type: 'sede'
      });

      // Marcador Edificio C (desde Edificio D Piso 1)
      if (/piso\s*1/i.test(this.currentFloorModel)) {
        const projC = projectWorldPointOnGround(-0.11572859910553213, 10.9685030423099);
        markers.push({
          id: 'marker-building-c',
          label: '→ Ir al Edificio C',
          x: projC.x,
          y: projC.y,
          visible: projC.visible,
          type: 'building-c'
        });
      }
    }

    this.onMarkersUpdatedCb(markers);
  }

  /**
   * Inserta un punto de codo en "L" entre el último waypoint del corredor y el destino final,
   * de modo que la flecha gire exactamente 90° en lugar de ir en diagonal a través de las paredes.
   *
   * Lógica:
   *  - Se detecta el eje dominante del segmento anterior (X o Z).
   *  - El codo se coloca alineando primero ese eje con el destino, luego el eje perpendicular.
   *  - Solo se inserta si la desviación perpendicular es significativa (> umbral).
   */
  private insertElbowPoint(worldPoints: BABYLON.Vector3[]): BABYLON.Vector3[] {
    if (worldPoints.length < 2) return worldPoints;

    // Si la ruta ya tiene 3 o más puntos, el backend ya calculó el punto de inflexión
    // perpendicular exacto (giro de 90° frente a la sala), por lo que la ruta ya es óptima.
    if (worldPoints.length >= 3) {
      return worldPoints;
    }

    const THRESHOLD = 0.15; // distancia mínima para considerar un giro real

    const last = worldPoints[worldPoints.length - 1];        // destino final
    const prev = worldPoints[worldPoints.length - 2];        // último waypoint del corredor

    const dx = Math.abs(last.x - prev.x);
    const dz = Math.abs(last.z - prev.z);

    // Solo insertar codo si hay desviación en ambos ejes
    if (dx < THRESHOLD || dz < THRESHOLD) {
      return worldPoints; // ya es un movimiento casi recto, no hace falta codo
    }

    // Determinar el eje dominante del corredor mirando el segmento anterior
    let elbowPoint: BABYLON.Vector3;
    if (worldPoints.length >= 3) {
      const prevPrev = worldPoints[worldPoints.length - 3];
      const corridorDX = Math.abs(prev.x - prevPrev.x);
      const corridorDZ = Math.abs(prev.z - prevPrev.z);

      if (corridorDZ >= corridorDX) {
        // Corredor orientado en Z: primero avanzar en Z hasta alinearse con el destino, luego girar en X
        elbowPoint = new BABYLON.Vector3(prev.x, prev.y, last.z);
      } else {
        // Corredor orientado en X: primero avanzar en X hasta alinearse con el destino, luego girar en Z
        elbowPoint = new BABYLON.Vector3(last.x, prev.y, prev.z);
      }
    } else {
      // Solo 2 puntos: usar el eje con mayor diferencia como eje principal del corredor
      if (dz >= dx) {
        elbowPoint = new BABYLON.Vector3(prev.x, prev.y, last.z);
      } else {
        elbowPoint = new BABYLON.Vector3(last.x, prev.y, prev.z);
      }
    }

    // Insertar el codo antes del destino final
    const result = [...worldPoints];
    result.splice(result.length - 1, 0, elbowPoint);
    return result;
  }

  /**
   * Configura la ruta de navegación en el mapa 3D y posiciona a Inacapito caminando.
   * Reemplaza las flechas estáticas por el modelo 3D animado de Inacapito.
   * Llama a onSegmentDrawn con i=0 para activar la primera tarjeta de navegación.
   */
  private routeSegmentMeshes: BABYLON.AbstractMesh[][] = [];

  /**
   * Suaviza los vértices de la polilínea redondeando esquinas pronunciadas
   * para que la ruta y el giro de Inacapito se sientan naturales y fluidos.
   */
  public smoothWaypoints(points: BABYLON.Vector3[], maxCornerRadius = 0.35): BABYLON.Vector3[] {
    if (points.length < 3) return points;
    const result: BABYLON.Vector3[] = [points[0]];

    for (let i = 1; i < points.length - 1; i++) {
      const pPrev = points[i - 1];
      const pCurr = points[i];
      const pNext = points[i + 1];

      const vIn = pCurr.subtract(pPrev);
      const vOut = pNext.subtract(pCurr);
      const lenIn = vIn.length();
      const lenOut = vOut.length();

      if (lenIn < 0.35 || lenOut < 0.35) {
        result.push(pCurr);
        continue;
      }

      const dirIn = vIn.scale(1 / lenIn);
      const dirOut = vOut.scale(1 / lenOut);

      // Si los vectores son colineales (recta continua), no hace falta redondear
      const dot = BABYLON.Vector3.Dot(dirIn, dirOut);
      if (dot > 0.94 || dot < -0.94) {
        result.push(pCurr);
        continue;
      }

      const radius = Math.min(maxCornerRadius, lenIn * 0.35, lenOut * 0.35);
      const startRound = pCurr.subtract(dirIn.scale(radius));
      const endRound = pCurr.add(dirOut.scale(radius));
      const midControl = BABYLON.Vector3.Lerp(startRound, endRound, 0.5);
      const midRound = BABYLON.Vector3.Lerp(midControl, pCurr, 0.5);

      result.push(startRound, midRound, endRound);
    }

    result.push(points[points.length - 1]);
    return result;
  }

  /**
   * Limpia y desecha los meshes de los portales tridimensionales de acceso.
   */
  public clearAccessPortals(): void {
    if (this.portalAnimObserver && this.scene) {
      this.scene.onBeforeRenderObservable.remove(this.portalAnimObserver);
      this.portalAnimObserver = null;
    }
    this.portalMeshes.forEach(m => {
      if (!m.isDisposed()) m.dispose();
    });
    this.portalMeshes = [];
  }

  /**
   * Renderiza en el suelo los portales tridimensionales con halo luminoso en los puntos
   * de acceso oficiales entre edificios (según el piso actual cargado).
   */
  public renderAccessPortals(buildingId: BuildingId, floorModel: string): void {
    if (!this.scene || buildingId === 'S') return;
    this.clearAccessPortals();

    const pNum = (floorModel || '').replace(/\D/g, '') || '1';
    const portals: { id: string; name: string; position: { x: number; y: number; z: number }; color: BABYLON.Color3 }[] = [];

    if (buildingId === 'A') {
      const z = pNum === '3' ? -0.11 : pNum === '2' ? 0.51 : 0.64;
      const x = pNum === '3' ? 11.55 : pNum === '2' ? 11.60 : 11.65;
      const y = pNum === '3' ? 0.86 : pNum === '2' ? 0.41 : 0.05;
      portals.push({
        id: 'portal-a-b',
        name: 'Pasarela a Edificio B',
        position: { x, y, z },
        color: new BABYLON.Color3(1.0, 0.45, 0.1) // Naranja institucional INACAP
      });
    } else if (buildingId === 'B') {
      const x = pNum === '3' ? -0.10 : pNum === '2' ? -3.50 : -5.20;
      const z = pNum === '3' ? -8.70 : pNum === '2' ? -2.70 : -1.90;
      const y = pNum === '3' ? 0.20 : pNum === '2' ? 0.90 : 0.10;
      portals.push({
        id: 'portal-b-a',
        name: 'Conexión a Edificio A',
        position: { x, y, z },
        color: new BABYLON.Color3(0.15, 0.75, 1.0) // Cyan resplandeciente
      });
    } else if (buildingId === 'C') {
      portals.push({
        id: 'portal-c-d',
        name: 'Conector a Edificio D',
        position: { x: -2.40, y: 1.17, z: -2.20 },
        color: new BABYLON.Color3(0.2, 0.8, 0.4) // Verde esmeralda
      });
      portals.push({
        id: 'portal-c-e',
        name: 'Conector a Edificio E',
        position: { x: -3.160340012066989, y: 0.1469096839427877, z: 1.6463125327081438 },
        color: new BABYLON.Color3(0.9, 0.6, 0.1) // Ámbar dorado
      });
    } else if (buildingId === 'D') {
      portals.push({
        id: 'portal-d-c',
        name: 'Conector a Edificio C',
        position: { x: -0.05, y: 3.60, z: 11.10 },
        color: new BABYLON.Color3(0.9, 0.2, 0.6) // Magenta
      });
    } else if (buildingId === 'E') {
      portals.push({
        id: 'portal-e-c',
        name: 'Ir para el Edificio C',
        position: { x: -10.257817831379821, y: 0.28873252858175036, z: 0.5507832656850731 },
        color: new BABYLON.Color3(0.2, 0.8, 0.4) // Verde esmeralda
      });
    }

    portals.forEach((p, idx) => {
      // 1. Anillo exterior en el suelo
      const ring = BABYLON.MeshBuilder.CreateTorus(`portalRing_${idx}`, {
        diameter: 1.15,
        thickness: 0.035,
        tessellation: 32
      }, this.scene!);
      ring.position = new BABYLON.Vector3(p.position.x, p.position.y + 0.02, p.position.z);
      ring.rotation.x = Math.PI / 2;
      ring.isPickable = false;
      ring.renderingGroupId = 1;

      const ringMat = new BABYLON.StandardMaterial(`portalRingMat_${idx}`, this.scene!);
      ringMat.diffuseColor = p.color;
      ringMat.emissiveColor = p.color;
      ringMat.specularColor = BABYLON.Color3.Black();
      ringMat.alpha = 0.85;
      ring.material = ringMat;
      this.portalMeshes.push(ring);

      // 2. Disco interior luminoso suave
      const disc = BABYLON.MeshBuilder.CreateDisc(`portalDisc_${idx}`, {
        radius: 0.52,
        tessellation: 24
      }, this.scene!);
      disc.position = new BABYLON.Vector3(p.position.x, p.position.y + 0.015, p.position.z);
      disc.rotation.x = Math.PI / 2;
      disc.isPickable = false;
      disc.renderingGroupId = 1;

      const discMat = new BABYLON.StandardMaterial(`portalDiscMat_${idx}`, this.scene!);
      discMat.diffuseColor = p.color;
      discMat.emissiveColor = p.color.scale(0.6);
      discMat.specularColor = BABYLON.Color3.Black();
      discMat.alpha = 0.28;
      disc.material = discMat;
      this.portalMeshes.push(disc);

      // 3. Haz cilíndrico holográfico vertical
      const beacon = BABYLON.MeshBuilder.CreateCylinder(`portalBeacon_${idx}`, {
        height: 1.1,
        diameterTop: 0.75,
        diameterBottom: 1.05,
        tessellation: 16
      }, this.scene!);
      beacon.position = new BABYLON.Vector3(p.position.x, p.position.y + 0.55, p.position.z);
      beacon.isPickable = false;
      beacon.renderingGroupId = 1;

      const beaconMat = new BABYLON.StandardMaterial(`portalBeaconMat_${idx}`, this.scene!);
      beaconMat.diffuseColor = p.color;
      beaconMat.emissiveColor = p.color.scale(0.8);
      beaconMat.specularColor = BABYLON.Color3.Black();
      beaconMat.alpha = 0.10;
      beaconMat.backFaceCulling = false;
      beacon.material = beaconMat;
      this.portalMeshes.push(beacon);
    });

    // Animación continua de respiración/pulso para los portales
    if (this.portalMeshes.length > 0) {
      let t = 0;
      this.portalAnimObserver = this.scene.onBeforeRenderObservable.add(() => {
        t += 0.04;
        const pulse = 1.0 + Math.sin(t) * 0.06;
        for (let i = 0; i < this.portalMeshes.length; i += 3) {
          const ring = this.portalMeshes[i];
          const beacon = this.portalMeshes[i + 2];
          if (ring && !ring.isDisposed()) {
            ring.scaling.set(pulse, pulse, 1.0);
          }
          if (beacon && !beacon.isDisposed() && beacon.material) {
            (beacon.material as BABYLON.StandardMaterial).alpha = 0.08 + Math.sin(t) * 0.04;
          }
        }
      });
    }
  }

  public drawAnimatedRoute(
    points: BABYLON.Vector3[],
    clearExisting = true,
    onSegmentDrawn?: (
      segmentIndex: number,
      totalSegments: number,
      midpoint: BABYLON.Vector3,
      isLast: boolean
    ) => void,
    isEntranceTransition = false
  ): Promise<void> {
    return new Promise<void>(async (resolve) => {
      if (!this.scene || points.length < 2) {
        resolve();
        return;
      }
      if (clearExisting) {
        this.clearGuideArrows();
        this.routeSegmentMeshes = [];
      }

      ++this.currentRouteAnimId;

      // Nivelar altura Y al suelo del pasillo
      const corridorY = points[0].y;
      const leveledPoints: BABYLON.Vector3[] = points.map((p) =>
        new BABYLON.Vector3(p.x, corridorY + 0.08, p.z)
      );

      // Insertar punto de codo en L si son solo 2 puntos y suavizar curvas
      const elbowPoints = this.insertElbowPoint(leveledPoints);
      const worldPoints = this.smoothWaypoints(elbowPoints);
      const totalSegments = worldPoints.length - 1;

      // Configurar a Inacapito y la línea de ruta en el piso
      const meshes = await this.inacapitoGuide.setupRoute(this.scene, worldPoints, isEntranceTransition);
      this.guideArrowMeshes.push(...meshes);

      // Mostrar el primer segmento y notificar callback
      this.showRouteStep(0, totalSegments, onSegmentDrawn);

      resolve();
    });
  }

  /**
   * Muestra el segmento indicado y anima a Inacapito caminando a lo largo de él.
   * Llama al callback de navegación para sincronizar la tarjeta activa.
   */
  public showRouteStep(
    stepIndex: number,
    totalSegments?: number,
    onSegmentDrawn?: (
      segmentIndex: number,
      totalSegments: number,
      midpoint: BABYLON.Vector3,
      isLast: boolean
    ) => void
  ): void {
    const total = totalSegments ?? this.inacapitoGuide.getSegmentCount();
    this.inacapitoGuide.goToStep(stepIndex, total, onSegmentDrawn);
  }

  /** Retorna el número de segmentos de la ruta actualmente cargada. */
  public getRouteSegmentCount(): number {
    return this.inacapitoGuide.getSegmentCount();
  }

  /**
   * Proyecta un punto 3D en espacio mundo a coordenadas de pantalla (píxeles).
   * Utiliza la misma matriz de transformación que updateScreenMarkers.
   * Devuelve null si la escena, cámara o engine no están inicializados.
   */
  public projectWorldPointToScreen(
    worldPoint: BABYLON.Vector3
  ): { x: number; y: number; visible: boolean } | null {
    if (!this.scene || !this.camera || !this.engine) return null;

    const viewMatrix = this.camera.getViewMatrix();
    const projectionMatrix = this.camera.getProjectionMatrix();
    const transformMatrix = viewMatrix.multiply(projectionMatrix);
    const viewport = new BABYLON.Viewport(
      0, 0,
      this.engine.getRenderWidth(),
      this.engine.getRenderHeight()
    );

    const screenCoords = BABYLON.Vector3.Project(
      worldPoint,
      BABYLON.Matrix.Identity(),
      transformMatrix,
      viewport
    );

    const isVisible =
      screenCoords.z > 0 &&
      screenCoords.z < 1 &&
      screenCoords.x > 0 &&
      screenCoords.x < this.engine.getRenderWidth() &&
      screenCoords.y > 0 &&
      screenCoords.y < this.engine.getRenderHeight();

    return { x: screenCoords.x, y: screenCoords.y, visible: isVisible };
  }

  /**
   * Transforma un punto del espacio local del modelo OBJ al espacio mundo de Babylon.
   * Las coordenadas de Firestore (Locaciones, navigation-paths) están en el sistema de
   * coordenadas local del OBJ. Para dibujar flechas en la posición correcta se debe
   * aplicar la misma matriz mundo que usa el modelRoot (rotación, escala, traslación).
   */
  public localToWorld(localPoint: BABYLON.Vector3): BABYLON.Vector3 {
    if (!this.modelRoot) return localPoint.clone();
    return BABYLON.Vector3.TransformCoordinates(localPoint, this.modelRoot.getWorldMatrix());
  }

  public clearGuideArrows(): void {
    this.inacapitoGuide.clear();
    this.guideArrowMeshes.forEach(mesh => {
      if (!mesh.isDisposed()) mesh.dispose();
    });
    this.guideArrowMeshes = [];
    this.routeSegmentMeshes = [];
  }


  public setDestinationMarker(position: BABYLON.Vector3): void {
    if (!this.scene) return;
    this.clearDestinationMarker();

    const marker = new BABYLON.TransformNode('destinationMarker', this.scene);
    // position ya viene en coordenadas mundo (world space) reales del 3D viewport.
    // Se asigna directamente sin emparentar a modelRoot para evitar rotaciones duplicadas.
    marker.position = new BABYLON.Vector3(position.x, Math.max(position.y, 0.05), position.z);

    const material = new BABYLON.StandardMaterial('destMat', this.scene);
    material.diffuseColor = new BABYLON.Color3(0.95, 0.05, 0.05);
    material.emissiveColor = new BABYLON.Color3(0.8, 0.1, 0.1);

    const sphere = BABYLON.MeshBuilder.CreateSphere('destSphere', { diameter: 0.6 }, this.scene);
    sphere.position.y = 1.2;
    sphere.material = material;
    sphere.parent = marker;

    const cone = BABYLON.MeshBuilder.CreateCylinder('destCone', {
      height: 0.9,
      diameterTop: 0.6,
      diameterBottom: 0
    }, this.scene);
    cone.position.y = 0.45;
    cone.material = material;
    cone.parent = marker;

    this.destinationMarker = marker;
  }

  public clearDestinationMarker(): void {
    if (this.destinationMarker) {
      this.destinationMarker.dispose();
      this.destinationMarker = null;
    }
  }

  public zoomIn(): void {
    if (!this.camera) return;
    this.camera.radius = Math.max(4, this.camera.radius - 8);
    this.baseRadius = this.camera.radius;
    this.registerUserInteraction();
  }

  public zoomOut(): void {
    if (!this.camera) return;
    this.camera.radius = Math.min(350, this.camera.radius + 8);
    this.baseRadius = this.camera.radius;
    this.registerUserInteraction();
  }

  public resetCamera(): void {
    if (!this.camera) return;
    this.buildingFocusAnimId++;
    this.currentFocusedBuilding = null;
    this.clearBuildingHighlight();
    this.clearAccessPortals();
    const isSede = this.currentBuilding === 'S' || this.isSedeModelName(this.currentFloorModel, this.currentBuilding);
    const bldDef = this.buildingRegistry.getBuilding(this.currentBuilding);
    this.camera.target = BABYLON.Vector3.Zero();
    this.camera.alpha = isSede ? -Math.PI / 2 : (bldDef?.cameraBaseAlpha ?? (Math.PI / 4));
    this.camera.beta = isSede ? 1.18 : Math.PI / 3;
    this.camera.radius = isSede ? 210 : (bldDef?.cameraRadius ?? (this.currentBuilding === 'B' ? 36.4 : 28));
    this.baseRadius = this.camera.radius;
    this.registerUserInteraction();
  }

  /**
   * Obtiene la orientación del Norte respecto a la vista actual de la cámara (en grados).
   * El Norte real se ubica hacia donde antes apuntaba el sur (actual Este / derecha, alpha = 0).
   */
  public getCameraAlphaDeg(): number {
    if (!this.camera) return 0;
    // El Norte real se ubica hacia donde antes apuntaba el sur (alpha = 0, actual Este / derecha)
    const currentAlpha = this.camera.alpha;
    const needleDeg = -(currentAlpha * (180 / Math.PI));
    return ((needleDeg % 360) + 360) % 360;
  }

  /**
   * Registra un callback que se invoca en cada frame cuando cambia la rotación de la cámara.
   * Retorna una función para cancelar la suscripción.
   */
  public onCameraAngleChange(callback: (deg: number) => void): () => void {
    if (!this.scene) return () => {};
    let lastDeg: number | null = null;
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const deg = this.getCameraAlphaDeg();
      if (lastDeg === null || Math.abs(deg - lastDeg) > 0.05) {
        lastDeg = deg;
        callback(deg);
      }
    });
    return () => {
      this.scene?.onBeforeRenderObservable.remove(obs);
    };
  }

  /**
   * Alinea suavemente la cámara con el Norte real (alpha = 0, hacia el actual Este) tomando la ruta angular más corta.
   */
  public resetCameraToNorth(durationMs = 450): void {
    if (!this.camera) return;
    this.buildingFocusAnimId++;
    const startAlpha = this.camera.alpha;
    const twoPi = Math.PI * 2;
    const targetNorth = 0; // Norte real hacia el actual Este (donde antes apuntaba el sur)
    let diff = (targetNorth - (startAlpha % twoPi)) % twoPi;
    if (diff > Math.PI) diff -= twoPi;
    if (diff < -Math.PI) diff += twoPi;
    const endAlpha = startAlpha + diff;

    const startTime = performance.now();
    const animateStep = () => {
      if (!this.camera) return;
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.camera.alpha = startAlpha + (endAlpha - startAlpha) * eased;
      if (t < 1) {
        requestAnimationFrame(animateStep);
      }
    };
    requestAnimationFrame(animateStep);
    this.registerUserInteraction();
  }

  public getMeshByName(meshName: string): BABYLON.AbstractMesh | null {
    if (!this.scene) return null;

    let mesh = this.scene.getMeshByName(meshName);
    if (mesh) return mesh;

    const clean = (meshName || '').trim();
    const normalizedMeshName = clean.replace(/[^a-z0-9]/gi, '').toLowerCase();

    // 1. Coincidencia normalizada directa
    const directCandidate = this.scene.meshes.find((candidate) => {
      const meshNameCandidate = (candidate.name || '').toLowerCase();
      const normalizedCandidate = meshNameCandidate.replace(/[^a-z0-9]/gi, '');
      return meshNameCandidate === normalizedMeshName || normalizedCandidate === normalizedMeshName;
    });
    if (directCandidate) return directCandidate;

    // 2. Coincidencia por número de cuerpo/grupo (ej: "cuerpo17", "17" -> busca "C_P1_Grupo_17", "Grupo_17", "cuerpo17")
    const numMatch = clean.match(/(\d+)/);
    if (numMatch) {
      const targetNum = parseInt(numMatch[1], 10);
      const groupCandidate = this.scene.meshes.find((candidate) => {
        const cName = candidate.name || '';
        const cNumMatch = cName.match(/_grupo_?0*(\d+)/i) || cName.match(/^grupo_?0*(\d+)/i) || cName.match(/cuerpo_?0*(\d+)/i) || cName.match(/^[a-z]0*(\d{3})/i);
        return cNumMatch ? parseInt(cNumMatch[1], 10) === targetNum : false;
      });
      if (groupCandidate) return groupCandidate;
    }

    // 3. Coincidencia por código de sala (ej: "C101", "D101", "E101")
    const codeMatch = clean.match(/([a-e]\d{3})/i);
    if (codeMatch) {
      const targetCode = codeMatch[1].toLowerCase();
      const codeCandidate = this.scene.meshes.find((candidate) => {
        const cName = (candidate.name || '').toLowerCase();
        return cName.includes(targetCode);
      });
      if (codeCandidate) return codeCandidate;
    }

    return null;
  }

  /**
   * Determina de qué lado del eje central está un cuerpo, comparando su posición
   * world contra el centro del modelo (que ya está normalizado a x=0 / z=0 en loadModel).
   * Devuelve 1 o -1 según el lado. Útil para inferir automáticamente hacia dónde
   * "mira" el cuerpo sin mantener listas manuales.
   */
  public getMeshFacingSide(meshName: string, axis: 'x' | 'z' = 'x'): number | null {
    const mesh = this.getMeshByName(meshName);
    if (!mesh) return null;
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo({});
    const center = mesh.getBoundingInfo().boundingBox.centerWorld;
    const value = axis === 'x' ? center.x : center.z;
    return value >= 0 ? 1 : -1;
  }

  public focusOnMesh(meshName: string, targetRadius = 6, durationMs = 700, flipAngle = false, baseAlpha = Math.PI / 2): void {
    if (!this.camera || !this.scene) return;

    const targetMesh = this.getMeshByName(meshName);
    if (!targetMesh) return;

    targetMesh.computeWorldMatrix(true);
    targetMesh.refreshBoundingInfo({});
    const boundingInfo = targetMesh.getBoundingInfo();
    const targetPosition = boundingInfo.boundingBox.centerWorld.clone();

        // Ángulo fijo tipo "vista desde dentro" para todos los cuerpos
    const targetAlpha = flipAngle ? baseAlpha + Math.PI : baseAlpha;
    const targetBeta = Math.PI / 2 - 0.6; // casi horizontal, mirando hacia el frente

    console.log('FOCUS MESH DEBUG ->', { meshName, targetRadius, flipAngle, baseAlpha, targetAlpha, targetBeta });
    
    const startTarget = this.camera.target.clone();
    const startRadius = this.camera.radius;
    const startAlpha = this.camera.alpha;
    const startBeta = this.camera.beta;
    const startTime = performance.now();

    const animateStep = () => {
      if (!this.camera) return;
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out

      const newTarget = BABYLON.Vector3.Lerp(startTarget, targetPosition, eased);
      this.camera.target = newTarget;
      this.camera.radius = startRadius + (targetRadius - startRadius) * eased;
      this.camera.alpha = startAlpha + (targetAlpha - startAlpha) * eased;
      this.camera.beta = startBeta + (targetBeta - startBeta) * eased;

      if (t < 1) {
        requestAnimationFrame(animateStep);
      }
    };

    requestAnimationFrame(animateStep);
  }

  public getMeshWorldPosition(locName: string, cuerpoId?: string): BABYLON.Vector3 | null {
    if (!this.scene) return null;

    const findMeshCI = (name: string): BABYLON.AbstractMesh | null => {
      if (!name || !this.scene) return null;
      return this.getMeshByName(name);
    };

    // 1. Buscar por cuerpoId explícito (ej. cuerpo15 o Cuerpo15)
    let targetMesh = cuerpoId ? findMeshCI(cuerpoId) : null;

    // 2. Si no se encontró por cuerpoId, buscar por locName
    if (!targetMesh && locName) {
      targetMesh = findMeshCI(locName);

      // 3. Fallbacks para nombres clave como 'ConectorEdificioB', 'Escaleras', 'Acceso'
      if (!targetMesh) {
        const normLoc = locName.toLowerCase();
        if (normLoc.includes('conector') || normLoc.includes('acceso') || normLoc.includes('escalera') || normLoc.includes('main')) {
          targetMesh = findMeshCI('cuerpo3') || findMeshCI('cuerpo1') || findMeshCI('cuerpo13');
        }
      }
    }

    if (!targetMesh) return null;

    targetMesh.computeWorldMatrix(true);
    targetMesh.refreshBoundingInfo({});
    return targetMesh.getBoundingInfo().boundingBox.centerWorld.clone();
  }

  /**
   * Procesa la captura de coordenadas 3D para una posición de pantalla o PickingInfo.
   * Emite el valor al listener angular e imprime en consola si es un clic.
   */
  private processCoordinatePick(
    pickInfo?: BABYLON.PickingInfo | null,
    screenX?: number,
    screenY?: number,
    isClick = false
  ): void {
    if (!this.scene) return;

    let pick = pickInfo;
    if (!pick || !pick.hit || !pick.pickedPoint) {
      const px = screenX !== undefined ? screenX : this.scene.pointerX;
      const py = screenY !== undefined ? screenY : this.scene.pointerY;
      if (px !== undefined && py !== undefined && !isNaN(px) && !isNaN(py)) {
        pick = this.scene.pick(px, py, (m) => m.isVisible && m.name !== 'skyBox') || pick;
      }
    }

    let pickedPoint = pick?.pickedPoint;
    const pickedMesh = pick?.pickedMesh;
    const meshName = pickedMesh?.name || 'suelo/espacio';

    // Si no impactó directamente en una malla, proyectar rayo al plano horizontal Y = 0.05
    if (!pickedPoint && this.camera && screenX !== undefined && screenY !== undefined) {
      const ray = this.scene.createPickingRay(screenX, screenY, BABYLON.Matrix.Identity(), this.camera);
      const floorY = 0.05;
      const denom = ray.direction.y;
      if (Math.abs(denom) > 0.0001) {
        const t = (floorY - ray.origin.y) / denom;
        if (t > 0) {
          pickedPoint = ray.origin.add(ray.direction.scale(t));
        }
      }
    }

    if (pickedPoint) {
      // Detección inteligente de cuerpo si impactó en suelo, espacio o estructura de fondo
      let resolvedMesh = pickedMesh;
      let resolvedName = meshName;
      if ((!pickedMesh || /suelo|ground|espacio|skybox|piso|estructura/i.test(meshName)) && this.modelRoot) {
        const candidateMeshes = this.modelRoot.getChildMeshes(false, (m: any) => m.isVisible && !/suelo|ground|skybox|base_maqueta|estructura/i.test(m.name || ''));
        let closestDist = Infinity;
        let closestMesh: BABYLON.AbstractMesh | null = null;
        for (const m of candidateMeshes) {
          const bi = m.getBoundingInfo();
          const min = bi.boundingBox.minimumWorld;
          const max = bi.boundingBox.maximumWorld;
          if (pickedPoint.x >= min.x && pickedPoint.x <= max.x && pickedPoint.z >= min.z && pickedPoint.z <= max.z) {
            closestMesh = m;
            break;
          }
          const center = bi.boundingBox.centerWorld;
          const dist = Math.hypot(pickedPoint.x - center.x, pickedPoint.z - center.z);
          if (dist < closestDist && dist < 4.0) {
            closestDist = dist;
            closestMesh = m;
          }
        }
        if (closestMesh) {
          resolvedMesh = closestMesh;
          resolvedName = closestMesh.name;
        }
      }

      // Extraer estrictamente el número de cuerpo (NUNCA mezclar con la sala)
      const cleanR = resolvedName.replace(/\s+/g, '').toLowerCase();
      const cMatch = cleanR.match(/^cuerpo(\d+)/i) || cleanR.match(/cuerpo\s*(\d+)/i);
      const gMatch = cleanR.match(/^[a-z]_p\d+_grupo_?(\d+)/i) || cleanR.match(/^grupo_?(\d+)/i);
      const mMatch = cleanR.match(/^mesh(\d+)/i);
      const roomMatch = cleanR.match(/^([a-z])(\d{3})/i);

      let cuerpoLabel = '';
      if (cMatch) {
        cuerpoLabel = `Cuerpo ${cMatch[1]}`;
      } else if (gMatch) {
        cuerpoLabel = `Cuerpo ${gMatch[1]}`;
      } else if (mMatch) {
        cuerpoLabel = `Cuerpo ${mMatch[1]}`;
      } else if (roomMatch) {
        cuerpoLabel = `Cuerpo ${roomMatch[2]}`;
      }

      // La sala va por separado si la malla lleva el código de sala (ej. E101, D201, C102)
      const salaLabel = roomMatch ? `Sala ${roomMatch[0].toUpperCase()}` : '';

      this.lastHoveredCoords = pickedPoint.clone();
      this.lastHoveredMeshName = resolvedName;
      this.lastHoveredCuerpo = cuerpoLabel;
      this.lastHoveredSala = salaLabel;

      if (this.onCoordinatesUpdatedCb) {
        this.onCoordinatesUpdatedCb({
          coords: this.lastHoveredCoords,
          meshName: resolvedName,
          cuerpo: cuerpoLabel,
          sala: salaLabel,
          building: this.currentBuilding,
          floor: this.currentFloorModel
        });
      }

      if (isClick) {
        const xStr = pickedPoint.x.toFixed(2);
        const yStr = pickedPoint.y.toFixed(2);
        const zStr = pickedPoint.z.toFixed(2);

        // Formato clásico histórico del proyecto (compatibilidad F12):
        console.log('Mesh seleccionado:', resolvedName, '| Cuerpo:', cuerpoLabel || 'Sin cuerpo asignado', '| Sala:', salaLabel || 'N/A', '| Coordenadas:', pickedPoint);

        // Formato destacado en consola F12 separando claramente Cuerpo de Sala:
        const cuerpoPart = cuerpoLabel ? ` | %c${cuerpoLabel}%c` : '';
        const salaPart = salaLabel ? ` | %c${salaLabel}%c` : '';
        console.log(
          `%c📍 COORDENADAS 3D [F12] %c Mesh: %c${resolvedName}%c${cuerpoPart}${salaPart} | X: ${xStr}, Y: ${yStr}, Z: ${zStr} (Edificio: ${this.currentBuilding}, Piso: ${this.currentFloorModel})\n` +
          `%c📋 JSON Firestore:%c { "x": ${xStr}, "y": ${yStr}, "z": ${zStr} }`,
          'background: #111; color: #00ffaa; font-weight: bold; padding: 3px 8px; border-radius: 4px;',
          'color: #aaa;',
          'color: #ffaa00; font-weight: bold;',
          'color: #aaa;',
          ...(cuerpoLabel ? ['color: #00ccff; font-weight: bold; font-size: 13px;', 'color: #aaa;'] : []),
          ...(salaLabel ? ['color: #68d391; font-weight: bold; font-size: 13px;', 'color: #aaa;'] : []),
          'color: #ffffff; font-weight: bold;',
          'color: #a0aec0; font-family: monospace;',
          'color: #f6e05e; font-weight: bold; font-family: monospace;'
        );
      }
    }
  }

  /**
   * Suscripción para recibir cambios de coordenadas 3D en tiempo real (para HUD UI).
   */
  public onCoordinatesChange(
    cb: (data: { coords: BABYLON.Vector3 | null; meshName: string; cuerpo: string; sala: string; building: BuildingId; floor: string }) => void
  ): () => void {
    this.onCoordinatesUpdatedCb = cb;
    return () => {
      if (this.onCoordinatesUpdatedCb === cb) {
        this.onCoordinatesUpdatedCb = undefined;
      }
    };
  }

  /**
   * Imprime en consola un resumen completo de coordenadas 3D al presionar F12 o invocar depuración.
   */
  public logCurrentCoordinates(trigger = 'F12'): void {
    const camTarget = this.camera?.target
      ? `X: ${this.camera.target.x.toFixed(2)}, Y: ${this.camera.target.y.toFixed(2)}, Z: ${this.camera.target.z.toFixed(2)}`
      : 'N/A';
    const camPos = this.camera?.position
      ? `X: ${this.camera.position.x.toFixed(2)}, Y: ${this.camera.position.y.toFixed(2)}, Z: ${this.camera.position.z.toFixed(2)}`
      : 'N/A';
    const ptrCoords = this.lastHoveredCoords
      ? `X: ${this.lastHoveredCoords.x.toFixed(2)}, Y: ${this.lastHoveredCoords.y.toFixed(2)}, Z: ${this.lastHoveredCoords.z.toFixed(2)}`
      : 'Haz clic o mueve el cursor sobre el mapa';
    const lastMesh = this.lastHoveredMeshName || 'Ninguno';

    // Extraer estrictamente número de cuerpo (sin sala)
    const cMatch2 = lastMesh.match(/cuerpo\s*(\d+)/i)
      || lastMesh.match(/^[a-z]_p\d+_grupo_?(\d+)/i)
      || lastMesh.match(/^grupo_?(\d+)/i)
      || lastMesh.match(/^mesh(\d+)/i)
      || lastMesh.match(/^[a-z](\d{3})/i);
    const cuerpoLabel2 = cMatch2 ? `Cuerpo ${cMatch2[1]}` : (this.lastHoveredCuerpo || 'Sin cuerpo');
    const rMatch2 = lastMesh.match(/^([a-z])(\d{3})/i);
    const salaLabel2 = rMatch2 ? `Sala ${rMatch2[0].toUpperCase()}` : (this.lastHoveredSala || '');

    const cuerpoDisplay = cuerpoLabel2 ? ` | ${cuerpoLabel2}` : '';
    const salaDisplay = salaLabel2 ? ` | ${salaLabel2}` : '';

    console.log(
      `%c📍 INACAP RENCA 3D — COORDENADAS [${trigger}] 📍%c\n` +
      `🏢 Edificio: ${this.currentBuilding} | Modelo/Piso: ${this.currentFloorModel}\n` +
      `🎯 Punto 3D Cursor: %c${ptrCoords}%c (Malla: ${lastMesh}${cuerpoDisplay}${salaDisplay})\n` +
      `📷 Cámara -> Target: ${camTarget} | Pos: ${camPos} | Radio: ${this.camera?.radius?.toFixed(2)} | Alpha: ${this.camera?.alpha?.toFixed(2)} | Beta: ${this.camera?.beta?.toFixed(2)}`,
      'background: #d32f2f; color: #fff; font-weight: bold; font-size: 13px; padding: 4px 10px; border-radius: 4px;',
      'color: #00ffaa; font-weight: bold; font-size: 12px;',
      'color: #ffaa00; font-weight: bold;',
      'color: #ffffff;'
    );
    if (this.lastHoveredCoords) {
      console.log('Vector3 Cursor:', this.lastHoveredCoords);
    }
    if (this.camera?.target) {
      console.log('Vector3 Cámara Target:', this.camera.target);
    }
  }

  public dispose(): void {
    if (this.f12KeyHandler) {
      window.removeEventListener('keydown', this.f12KeyHandler);
      this.f12KeyHandler = null;
    }
    this.buildingFocusAnimId++;
    this.currentFocusedBuilding = null;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.clearBuildingHighlight();
    this.clearAccessPortals();
    if (this.cartoTexture) {
      this.cartoTexture.dispose();
      this.cartoTexture = null;
    }
    if (this.urbanContextRoot) {
      this.urbanContextRoot.dispose(false, true);
      this.urbanContextRoot = null;
      this.cartoGround = null;
    }
    if (this.highlightLayer) {
      this.highlightLayer.dispose();
      this.highlightLayer = null;
    }
    if (this.engine) {
      this.engine.stopRenderLoop();
      this.engine.dispose();
      this.engine = null;
    }
    this.scene = null;
    this.camera = null;
  }

  ngOnDestroy(): void {
    this.dispose();
  }
}
