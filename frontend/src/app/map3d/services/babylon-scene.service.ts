import { Injectable, NgZone, OnDestroy } from '@angular/core';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { dibujarFlechaGuia } from './guide-arrow.service';
import { BuildingId } from '../../core/models/navegacion.model';

export interface ScreenMarker {
  id: string;
  label: string;
  x: number;
  y: number;
  visible: boolean;
  type: 'building-b' | 'building-a' | 'building-c' | 'sede';
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
  private currentRouteAnimId = 0;

  private currentBuilding: BuildingId = 'S';
  private currentFloorModel = 'INSTITUTO EN 3D.obj';

  private onMarkersUpdatedCb?: (markers: ScreenMarker[]) => void;

  // Propiedades para rotación continua de presentación y zoom sutil
  private isAutoRotateEnabled = true;
  private isUserInteracting = false;
  private idleTimer: any = null;
  private baseRadius = 210;
  private zoomTime = 0;

  // Iluminación y destacado de grupos en el modelo Sede
  private highlightLayer: BABYLON.HighlightLayer | null = null;
  private highlightedBuildingMeshes: BABYLON.AbstractMesh[] = [];
  private highlightPulseObserver: BABYLON.Observer<BABYLON.Scene> | null = null;

  constructor(private ngZone: NgZone) {}

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
    this.scene.clearColor = new BABYLON.Color4(0.06, 0.08, 0.12, 1);

    this.setupCamera(canvas);
    (window as any).__cam = this.camera; // TEMPORAL, solo para calibrar — borrar después
    this.setupLights();
    this.setupSkybox();

    this.scene.onPointerDown = (evt, pickResult) => {
      this.registerUserInteraction();
      if (evt.button === 0 && pickResult.hit && pickResult.pickedMesh) {
        console.log('Mesh seleccionado:', pickResult.pickedMesh.name, 'Coordenadas:', pickResult.pickedPoint);
        if (onMeshClicked) {
          onMeshClicked(pickResult.pickedMesh.name, pickResult);
        }
      }
    };

    this.scene.onPointerMove = (_evt, pickResult) => {
      const isSede = this.currentBuilding === 'S' || this.isSedeModelName(this.currentFloorModel, this.currentBuilding);
      if (isSede && canvas) {
        if (pickResult.hit && pickResult.pickedMesh && this.identifyBuildingFromMesh(pickResult.pickedMesh.name)) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'default';
        }
      } else if (canvas && canvas.style.cursor === 'pointer') {
        canvas.style.cursor = 'default';
      }
    };

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
    const initialRadius = isSede ? 210 : 25;
    this.camera = new BABYLON.ArcRotateCamera(
      'camera1',
      isSede ? -Math.PI / 2 : Math.PI / 4,
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

  private handleAutoRotation(): void {
    if (!this.camera || !this.isAutoRotateEnabled) return;

    const isSede =
      this.currentBuilding === 'S' ||
      this.currentFloorModel === 'INSTITUTO EN 3D.obj' ||
      this.currentFloorModel === 'INSTITUTO CON LETRAS CON BASE FORMATO SKP.obj' ||
      this.currentFloorModel === 'MODELO_INACAP_FIXED.obj';
    if (!isSede) return;

    const hasInertia =
      Math.abs(this.camera.inertialAlphaOffset) > 0.0001 ||
      Math.abs(this.camera.inertialBetaOffset) > 0.0001 ||
      Math.abs(this.camera.inertialRadiusOffset) > 0.0001 ||
      Math.abs(this.camera.inertialPanningX) > 0.0001 ||
      Math.abs(this.camera.inertialPanningY) > 0.0001;

    if (this.isUserInteracting || hasInertia || this.highlightedBuildingMeshes.length > 0) {
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
    const hemiLight = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 0.95;

    const dirLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-1, -2, -1), this.scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);
    dirLight.intensity = 0.7;
  }

  private setupSkybox(): void {
    if (!this.scene) return;
    const skybox = BABYLON.MeshBuilder.CreateBox('skyBox', { size: 1000.0 }, this.scene);
    const skyboxMaterial = new BABYLON.StandardMaterial('skyBoxMat', this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.emissiveColor = new BABYLON.Color3(0.06, 0.08, 0.12);
    skybox.material = skyboxMaterial;
  }


  private readonly buildingCentersInSede: Record<string, BABYLON.Vector3> = {
    A: new BABYLON.Vector3(31.2, 11.6, 25.5),
    B: new BABYLON.Vector3(31.9, 11.8, 46.1),
    C: new BABYLON.Vector3(-16.3, 10.5, 54.1),
    S: new BABYLON.Vector3(0, 0, 0)
  };

  /**
   * Identifica a qué edificio de la sede pertenece un mesh a partir de su nombre o grupos OBJ.
   */
  public identifyBuildingFromMesh(meshName: string): BuildingId | null {
    if (!meshName) return null;
    const normalized = meshName.replace(/[^a-z0-9]/gi, '').toLowerCase();

    // Edificio C: Grupo 41, 42, 43, C1, mesh119, etc.
    if (
      normalized.includes('group42') ||
      normalized.includes('group41') ||
      normalized.includes('group43') ||
      normalized.includes('c1') ||
      normalized.includes('mesh119') ||
      normalized.includes('edificioc')
    ) {
      return 'C';
    }

    // Edificio B: Grupo 31, 32, B1, mesh71, mesh73, etc.
    if (
      normalized.includes('group31') ||
      normalized.includes('group32') ||
      normalized.includes('b1') ||
      normalized.includes('mesh71') ||
      normalized.includes('mesh73') ||
      normalized.includes('edificiob')
    ) {
      return 'B';
    }

    // Edificio A: Grupo 65, 66, A1, mesh178, mesh74, etc.
    if (
      normalized.includes('group65') ||
      normalized.includes('group66') ||
      normalized.includes('a1') ||
      normalized.includes('mesh178') ||
      normalized.includes('mesh74') ||
      normalized.includes('edificioa')
    ) {
      return 'A';
    }

    return null;
  }

  /**
   * Obtiene todos los meshes que componen el volumen de un edificio dentro del modelo de la sede.
   */
  public getBuildingMeshesInSede(building: BuildingId, root?: BABYLON.TransformNode | null): BABYLON.AbstractMesh[] {
    const parentNode = root || this.modelRoot;
    if (!parentNode) return [];
    const regex = building === 'B'
      ? /b1|group31|group32|mesh71|mesh73|edificiob/i
      : building === 'C'
        ? /c1|group42|group41|group43|mesh119|edificioc/i
        : /a1|group65|group66|mesh178|mesh74|edificioa/i;

    return parentNode.getChildMeshes(false).filter(m => regex.test(m.name));
  }

  /**
   * Ilumina y destaca con resplandor y contorno el grupo de mallas de un edificio en la Sede.
   * Si building es null, remueve cualquier iluminación previa.
   */
  public highlightBuildingInSede(building: BuildingId | null): void {
    this.clearBuildingHighlight();
    if (!building || !this.modelRoot || !this.scene) return;

    const meshes = this.getBuildingMeshesInSede(building);
    if (meshes.length === 0) return;

    this.highlightedBuildingMeshes = meshes;

    // Color temático distintivo para cada edificio
    const glowColor = building === 'A'
      ? new BABYLON.Color3(1.0, 0.45, 0.08)  // Naranja característico INACAP
      : building === 'B'
        ? new BABYLON.Color3(0.08, 0.75, 1.0) // Cian tecnológico
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

  private getBuildingCenterInSede(sedeRoot: BABYLON.TransformNode, building: BuildingId): BABYLON.Vector3 {
    const regex = building === 'B'
      ? /b1|group31|mesh71|mesh73/i
      : building === 'C'
        ? /c1|group42|group41|mesh119/i
        : /a1|group65|mesh178|mesh74/i;

    const bMeshes = this.getBuildingMeshesInSede(building, sedeRoot);
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
    if (!this.camera || !this.scene) {
      outgoingRoot?.dispose(false, true);
      return;
    }

    const buildingCenter = this.getBuildingCenterInSede(incomingRoot, originBuilding);

    const incomingMeshes = incomingRoot.getChildMeshes(false);
    const outgoingMeshes = outgoingRoot ? outgoingRoot.getChildMeshes(false) : [];

    incomingMeshes.forEach(m => { m.visibility = 0; });
    outgoingMeshes.forEach(m => { m.visibility = 1; });

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
    if (!this.camera || !this.scene) {
      outgoingRoot?.dispose(false, true);
      return;
    }

    const buildingCenter = outgoingRoot
      ? this.getBuildingCenterInSede(outgoingRoot, targetBuilding)
      : (this.buildingCentersInSede[targetBuilding] || new BABYLON.Vector3(31.2, 11.6, 25.5));

    const incomingMeshes = incomingRoot.getChildMeshes(false);
    const outgoingMeshes = outgoingRoot ? outgoingRoot.getChildMeshes(false) : [];

    incomingMeshes.forEach(m => { m.visibility = 0; });
    outgoingMeshes.forEach(m => { m.visibility = 1; });

    const startTarget = this.camera.target.clone();
    const endTarget   = BABYLON.Vector3.Zero();

    const startRadius = this.camera.radius;
    const endRadius   = 36.4;

    const startAlpha = this.camera.alpha;
    const startBeta  = this.camera.beta;
    const endAlpha   = Math.PI / 4;
    const endBeta    = Math.PI / 3;

    const duration = 1200;
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

    if (this.modelRoot) {
      this.modelRoot.dispose(false, true);
      this.modelRoot = null;
    }

    // Disponer cualquier malla previa que no sea skybox o marcador
    this.scene.meshes.slice().forEach(mesh => {
      if (mesh.name !== 'skyBox' && !mesh.name.startsWith('dest') && mesh.name !== 'ground') {
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
        this.baseRadius = this.camera.radius;
      }
    }
  }

  /**
   * Determina si un nombre de modelo corresponde al modelo de la Sede.
   */
  private isSedeModelName(modelName: string, buildingId: BuildingId): boolean {
    return buildingId === 'S' ||
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

    const isSede      = this.isSedeModelName(modelName, buildingId);
    const isBuildingB = buildingId === 'B' || modelName.includes('Edificio B');
    const isBuildingC = buildingId === 'C' || modelName.includes('Edificio C');

    const rootUrl = isSede
      ? '/assets/3d-models/sede/'
      : isBuildingB
        ? '/assets/3d-models/Edificio B/'
        : isBuildingC
          ? '/assets/3d-models/Edificio C/'
          : '/assets/3d-models/Edificio A/';

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

    allNodes.rotation = isSede
      ? new BABYLON.Vector3(0, -Math.PI / 2, 0)
      : isBuildingC
        ? new BABYLON.Vector3(0, -Math.PI / 2, 0)
        : new BABYLON.Vector3(-Math.PI / 2, Math.PI, 0);

    if (isBuildingB) {
      allNodes.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
    }

    result.meshes.forEach((mesh, index) => {
      mesh.isVisible = true;
      mesh.parent = allNodes;
      mesh.isPickable = true;
      mesh.checkCollisions = true;

      if (!mesh.material) {
        const defaultMat = new BABYLON.StandardMaterial(`defaultMat_${index}`, this.scene!);
        defaultMat.diffuseColor = new BABYLON.Color3(0.85, 0.85, 0.9);
        mesh.material = defaultMat;
      }

      const material: any = mesh.material;
      if (material) {
        material.emissiveColor = new BABYLON.Color3(0, 0, 0);
        if ('specularColor' in material) material.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);
        if ('ambientColor'  in material) material.ambientColor  = new BABYLON.Color3(0.04, 0.04, 0.04);
        if ('metallic'      in material) material.metallic      = 0;
        if ('roughness'     in material) material.roughness     = Math.min(1, Math.max(material.roughness ?? 1, 0.85));
        if ('specularPower' in material) material.specularPower = 8;
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
      allNodes.position.y = -scaledBounds.min.y;
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
    direction: 'up' | 'down' | 'left' | 'right' | 'lateral-right' | 'lateral-left' = 'up'
  ): Promise<void> {
    if (!this.scene) return;

    const buildingId: BuildingId = typeof building === 'boolean' ? (building ? 'B' : 'A') : building;

    const isSameModel = modelName === this.currentFloorModel && buildingId === this.currentBuilding && this.modelRoot !== null;
    if (isSameModel) return;

    this.currentFloorModel = modelName;
    this.currentBuilding   = buildingId;
    this.clearBuildingHighlight();

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

    const prevBuilding = this.currentBuilding;
    const prevFloor = this.currentFloorModel;
    const isSede = this.isSedeModelName(modelName, buildingId);
    const wasSede = this.isSedeModelName(prevFloor, prevBuilding);

    // ── Transición especial hacia la SEDE (Zoom-out desde el edificio de origen) ──
    if (isSede && !wasSede && (prevBuilding === 'A' || prevBuilding === 'B' || prevBuilding === 'C')) {
      this.currentFloorModel = modelName;
      this.currentBuilding   = buildingId;
    this.clearBuildingHighlight();
      await this.animateTransitionToSede(outgoingRoot, incomingRoot, prevBuilding);
      return;
    }

    // ── Transición especial desde la SEDE hacia un edificio (Zoom-in hacia el pasillo) ──
    if (wasSede && !isSede && (buildingId === 'A' || buildingId === 'B' || buildingId === 'C')) {
      this.currentFloorModel = modelName;
      this.currentBuilding   = buildingId;
    this.clearBuildingHighlight();
      await this.animateTransitionFromSede(outgoingRoot, incomingRoot, buildingId);
      return;
    }

    // ── Preparar animación en 3 etapas con proximidad clara ───────────────────
    const isLateral = direction === 'left' || direction === 'right' || direction === 'lateral-right' || direction === 'lateral-left';
    const isSlideRight = direction === 'right' || direction === 'lateral-right';

    const OFFSET_Y = 26;
    const GAP_Y    = 4.2;
    const OFFSET_X = 35;
    const GAP_X    = 6.0;

    const incomingBaseY = incomingRoot.position.y;
    const outgoingBaseY = outgoingRoot ? outgoingRoot.position.y : 0;
    const incomingBaseX = incomingRoot.position.x;
    const outgoingBaseX = outgoingRoot ? outgoingRoot.position.x : 0;

    let incomingStartY: number, meetY: number, outgoingExitY: number;
    let incomingStartX: number, meetX: number, outgoingExitX: number;

    if (isLateral) {
      incomingStartY = incomingBaseY;
      meetY          = incomingBaseY;
      outgoingExitY  = outgoingBaseY;

      incomingStartX = isSlideRight ? incomingBaseX + OFFSET_X : incomingBaseX - OFFSET_X;
      meetX          = isSlideRight ? outgoingBaseX + GAP_X   : outgoingBaseX - GAP_X;
      outgoingExitX  = isSlideRight ? outgoingBaseX - OFFSET_X : outgoingBaseX + OFFSET_X;

      incomingRoot.position.x = incomingStartX;
      incomingRoot.position.y = incomingBaseY;
    } else {
      incomingStartX = incomingBaseX;
      meetX          = incomingBaseX;
      outgoingExitX  = outgoingBaseX;

      incomingStartY = direction === 'up' ? incomingBaseY + OFFSET_Y : incomingBaseY - OFFSET_Y;
      meetY          = direction === 'up' ? outgoingBaseY + GAP_Y   : outgoingBaseY - GAP_Y;
      outgoingExitY  = direction === 'up' ? outgoingBaseY - OFFSET_Y : outgoingBaseY + OFFSET_Y;

      incomingRoot.position.x = incomingBaseX;
      incomingRoot.position.y = incomingStartY;
    }

    const incomingMeshes = incomingRoot.getChildMeshes(false);
    const outgoingMeshes = outgoingRoot ? outgoingRoot.getChildMeshes(false) : [];
    const arrowMeshes    = this.guideArrowMeshes.slice();

    incomingMeshes.forEach(m => { m.visibility = 0; });

    // ── Animación en 3 etapas (~2200ms total) ──────────────────────────────────
    const DURATION_MS = 2200;
    const P1 = 0.44; // fin de etapa 1 (~968ms)
    const P2 = 0.64; // fin de etapa 2 (~1408ms, pausa de proximidad de ~440ms)

    const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
    const easeInOutQuad = (t: number): number =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const startTime = performance.now();

    await new Promise<void>(resolve => {
      const step = () => {
        const elapsed = performance.now() - startTime;
        const raw     = Math.min(elapsed / DURATION_MS, 1);

        let incomingX: number;
        let outgoingX: number;
        let incomingY: number;
        let outgoingY: number;
        let incomingAlpha: number;
        let outgoingAlpha: number;

        if (raw <= P1) {
          const t = easeOutCubic(raw / P1);
          incomingX     = isLateral ? incomingStartX + (meetX - incomingStartX) * t : incomingBaseX;
          incomingY     = isLateral ? incomingBaseY : incomingStartY + (meetY - incomingStartY) * t;
          outgoingX     = outgoingBaseX;
          outgoingY     = outgoingBaseY;
          incomingAlpha = Math.min(1, t * 1.25);
          outgoingAlpha = 1;
        } else if (raw <= P2) {
          incomingX     = isLateral ? meetX : incomingBaseX;
          incomingY     = isLateral ? incomingBaseY : meetY;
          outgoingX     = outgoingBaseX;
          outgoingY     = outgoingBaseY;
          incomingAlpha = 1;
          outgoingAlpha = 1;
        } else {
          const localProgress = (raw - P2) / (1 - P2);
          const tExit         = easeInOutQuad(localProgress);

          incomingX     = isLateral ? meetX + (incomingBaseX - meetX) * localProgress : incomingBaseX;
          incomingY     = isLateral ? incomingBaseY : meetY + (incomingBaseY - meetY) * localProgress;
          outgoingX     = isLateral ? outgoingBaseX + (outgoingExitX - outgoingBaseX) * tExit : outgoingBaseX;
          outgoingY     = isLateral ? outgoingBaseY : outgoingBaseY + (outgoingExitY - outgoingBaseY) * tExit;
          incomingAlpha = 1;
          outgoingAlpha = Math.max(0, 1 - localProgress);
        }

        if (incomingRoot && !incomingRoot.isDisposed()) {
          incomingRoot.position.x = incomingX;
          incomingRoot.position.y = incomingY;
        }
        if (outgoingRoot && !outgoingRoot.isDisposed()) {
          outgoingRoot.position.x = outgoingX;
          outgoingRoot.position.y = outgoingY;
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
            incomingRoot.getChildMeshes(false).forEach(m => { m.visibility = 1; });
          }
          this.clearGuideArrows();
          outgoingRoot?.dispose(false, true);
          resolve();
        }
      };

      requestAnimationFrame(step);
    });

    // ── Respetar la perspectiva activa del usuario ─────────────────────────
    // NO forzar camera.setTarget, alpha, beta ni radius en cambios de piso o mapa.
    // La vista se mantiene fluida y continua exactamente donde el usuario la tenía.
    if (this.camera) {
      this.baseRadius = this.camera.radius;
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
      heightOffset = 0.05
    ): { x: number; y: number; visible: boolean } => {
      let groundY = 0;
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
          label: '→ Ir al mapa principal',
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
        label: '→ al mapa principal',
        x: proj.x,
        y: proj.y,
        visible: proj.visible,
        type: 'sede'
      });
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
   * Dibuja todos los segmentos de la ruta de una vez (sin animación automática).
   * Los meshes de cada segmento se almacenan en routeSegmentMeshes para que
   * showRouteStep() pueda mostrar/ocultar cada uno individualmente.
   * El primer segmento se muestra visible; los demás comienzan ocultos.
   * Llama a onSegmentDrawn con i=0 para activar la primera tarjeta de navegación.
   */
  private routeSegmentMeshes: BABYLON.AbstractMesh[][] = [];

  public drawAnimatedRoute(
    points: BABYLON.Vector3[],
    clearExisting = true,
    onSegmentDrawn?: (
      segmentIndex: number,
      totalSegments: number,
      midpoint: BABYLON.Vector3,
      isLast: boolean
    ) => void
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.scene || points.length < 2) {
        resolve();
        return;
      }
      if (clearExisting) {
        this.clearGuideArrows();
        this.routeSegmentMeshes = [];
      }

      ++this.currentRouteAnimId;
      const color = new BABYLON.Color3(0.95, 0.08, 0.08);

      // Nivelar altura Y al suelo del pasillo
      const corridorY = points[0].y;
      const leveledPoints: BABYLON.Vector3[] = points.map((p) =>
        new BABYLON.Vector3(p.x, corridorY + 0.08, p.z)
      );

      // Insertar punto de codo en L si son solo 2 puntos
      const worldPoints = this.insertElbowPoint(leveledPoints);
      const totalSegments = worldPoints.length - 1;

      // Dibujar todos los segmentos de una vez, empezando solo el primero visible
      for (let i = 0; i < totalSegments; i++) {
        const worldFrom = worldPoints[i];
        const worldTo   = worldPoints[i + 1];
        const meshes = dibujarFlechaGuia(this.scene, worldFrom, worldTo, color);
        this.routeSegmentMeshes.push(meshes);
        this.guideArrowMeshes.push(...meshes);

        // Ocultar todos; luego showRouteStep(0) mostrará el primero
        meshes.forEach(m => { m.isVisible = false; });
      }

      // Mostrar el primer segmento y notificar callback
      this.showRouteStep(0, totalSegments, onSegmentDrawn);

      resolve();
    });
  }

  /**
   * Muestra únicamente el segmento indicado (por índice) y oculta los demás.
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
    const total = totalSegments ?? this.routeSegmentMeshes.length;
    const clampedIdx = Math.max(0, Math.min(stepIndex, this.routeSegmentMeshes.length - 1));

    this.routeSegmentMeshes.forEach((meshes, i) => {
      meshes.forEach(m => { m.isVisible = (i === clampedIdx); });
    });

    if (onSegmentDrawn && this.routeSegmentMeshes.length > 0) {
      const meshes = this.routeSegmentMeshes[clampedIdx];
      if (meshes && meshes.length > 0) {
        // Calcular midpoint del segmento activo
        const pos0 = meshes[0].position;
        const posLast = meshes[meshes.length - 1].position;
        const midpoint = new BABYLON.Vector3(
          (pos0.x + posLast.x) / 2,
          (pos0.y + posLast.y) / 2,
          (pos0.z + posLast.z) / 2
        );
        const isLast = clampedIdx + 1 >= total;
        onSegmentDrawn(clampedIdx, total, midpoint, isLast);
      }
    }
  }

  /** Retorna el número de segmentos de la ruta actualmente cargada. */
  public getRouteSegmentCount(): number {
    return this.routeSegmentMeshes.length;
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
    this.guideArrowMeshes.forEach(mesh => mesh.dispose());
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
    this.camera.target = new BABYLON.Vector3(0, 0, 0);
    this.camera.alpha = Math.PI / 4;
    this.camera.beta = Math.PI / 3;
    const isSede = this.currentBuilding === 'S' || this.isSedeModelName(this.currentFloorModel, this.currentBuilding);
    this.camera.alpha = isSede ? -Math.PI / 2 : Math.PI / 4;
    this.camera.beta = isSede ? 1.18 : Math.PI / 3;
    this.camera.radius = isSede ? 210 : (this.currentBuilding === 'A' ? 52 : 25);
    this.baseRadius = this.camera.radius;
    this.registerUserInteraction();
  }

  public getMeshByName(meshName: string): BABYLON.AbstractMesh | null {
    if (!this.scene) return null;

    let mesh = this.scene.getMeshByName(meshName);
    if (mesh) return mesh;

    const normalizedMeshName = (meshName || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    return this.scene.meshes.find((candidate) => {
      const meshNameCandidate = (candidate.name || '').toLowerCase();
      const normalizedCandidate = meshNameCandidate.replace(/[^a-z0-9]/gi, '');
      return meshNameCandidate === normalizedMeshName || normalizedCandidate === normalizedMeshName;
    }) ?? null;
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

    const targetMesh = this.scene.getMeshByName(meshName);
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
      let mesh = this.scene.getMeshByName(name);
      if (mesh) return mesh;
      const lower = name.toLowerCase();
      const norm = name.replace(/[^a-z0-9]/gi, '').toLowerCase();
      return this.scene.meshes.find(m => {
        const mName = (m.name || '').toLowerCase();
        const mNorm = mName.replace(/[^a-z0-9]/gi, '');
        return mName === lower || mNorm === norm;
      }) ?? null;
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

  public dispose(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.clearBuildingHighlight();
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
