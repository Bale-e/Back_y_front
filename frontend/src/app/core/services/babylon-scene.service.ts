import { Injectable, NgZone, OnDestroy } from '@angular/core';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { dibujarFlechaGuia } from '../../services/guide-arrow.service';

export interface ScreenMarker {
  id: string;
  label: string;
  x: number;
  y: number;
  visible: boolean;
  type: 'building-b' | 'building-a' | 'sede';
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

  private currentBuilding: 'A' | 'B' | 'S' = 'A';
  private currentFloorModel = 'Edifico A - Piso 1.obj';

  private onMarkersUpdatedCb?: (markers: ScreenMarker[]) => void;

  // Propiedades para rotación continua de presentación y zoom sutil
  private isAutoRotateEnabled = true;
  private isUserInteracting = false;
  private idleTimer: any = null;
  private baseRadius = 77;
  private zoomTime = 0;

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
    this.camera = new BABYLON.ArcRotateCamera(
      'camera1',
      Math.PI / 4,
      Math.PI / 3,
      25,
      new BABYLON.Vector3(0, 0, 0),
      this.scene
    );
    this.camera.lowerRadiusLimit = 2;
    this.camera.upperRadiusLimit = 200;
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

    const isSede = this.currentBuilding === 'S' || this.currentFloorModel === 'MODELO_INACAP_FIXED.obj';
    if (!isSede) return;

    const hasInertia =
      Math.abs(this.camera.inertialAlphaOffset) > 0.0001 ||
      Math.abs(this.camera.inertialBetaOffset) > 0.0001 ||
      Math.abs(this.camera.inertialRadiusOffset) > 0.0001 ||
      Math.abs(this.camera.inertialPanningX) > 0.0001 ||
      Math.abs(this.camera.inertialPanningY) > 0.0001;

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
    const maxR = this.camera.upperRadiusLimit ?? 150;
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

  public async loadModel(modelName: string, building: 'A' | 'B' | 'S' | boolean = 'A'): Promise<void> {
    if (!this.scene) return;

    const buildingId: 'A' | 'B' | 'S' = typeof building === 'boolean' ? (building ? 'B' : 'A') : building;

    // Si es el mismo modelo ya cargado, conservar la vista de cámara actual al terminar
    const isSameModel = modelName === this.currentFloorModel && buildingId === this.currentBuilding && this.modelRoot !== null;
    const savedCamera = isSameModel && this.camera ? {
      alpha:  this.camera.alpha,
      beta:   this.camera.beta,
      radius: this.camera.radius,
      target: this.camera.target.clone()
    } : null;

    this.currentFloorModel = modelName;
    this.currentBuilding = buildingId;

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

    const isSede = buildingId === 'S' || modelName === 'MODELO_INACAP_FIXED.obj';
    const isBuildingB = buildingId === 'B' || modelName.includes('Edificio B');

    const rootUrl = isSede
      ? '/assets/3d-models/sede/'
      : isBuildingB
        ? '/assets/3d-models/Edificio B/'
        : '/assets/3d-models/Edificio A/';

    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        encodeURI(rootUrl),
        encodeURI(modelName),
        this.scene
      );

      if (result.meshes.length === 0) return;

      // Volver a limpiar por si otra llamada asíncrona dejó un modelRoot
      if (this.modelRoot) {
        this.modelRoot.dispose(false, true);
        this.modelRoot = null;
      }

      const allNodes = new BABYLON.TransformNode('modelRoot', this.scene);
      this.modelRoot = allNodes;

      allNodes.rotation = isSede
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
      });

      const bounds = allNodes.getHierarchyBoundingVectors(true);
      const size = BABYLON.Vector3.Distance(bounds.min, bounds.max);
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

      if (this.camera && this.modelRoot) {
        // Center the camera on the origin, since the model has been translated to be centered.
        this.camera.setTarget(BABYLON.Vector3.Zero());
        if (isSede) {
          this.camera.radius = 77;
          this.camera.alpha = -Math.PI / 2;
          this.camera.beta = 1.25;
          this.baseRadius = 77;
          this.zoomTime = 0;
        } else if (isBuildingB) {
          this.camera.radius = 36.4;
          this.camera.alpha = Math.PI / 4;
          this.camera.beta = Math.PI / 3;
          this.baseRadius = 36.4;
        } else {
          this.camera.radius = 36.4;
          this.camera.alpha = Math.PI / 4;
          this.camera.beta = Math.PI / 3;
          this.baseRadius = 36.4;
        }

        // Si se recargó el mismo piso (ej. al seleccionar un destino), restaurar la vista anterior
        if (savedCamera) {
          this.camera.alpha  = savedCamera.alpha;
          this.camera.beta   = savedCamera.beta;
          this.camera.radius = savedCamera.radius;
          this.camera.setTarget(savedCamera.target);
          this.baseRadius = savedCamera.radius;
        }
      }
    } catch (err) {
      console.error(`Error al cargar modelo 3D (${rootUrl}${modelName}):`, err);
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
    if (this.currentBuilding === 'B' && !this.currentFloorModel.includes('Piso 3')) {
      const proj = projectWorldPointOnGround(-5.336930000984566, -1.9430948868138938);
      markers.push({
        id: 'marker-building-a',
        label: '← Volver al Edificio A',
        x: proj.x,
        y: proj.y,
        visible: proj.visible,
        type: 'building-a'
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

  public drawAnimatedRoute(points: BABYLON.Vector3[]): void {
    if (!this.scene || points.length < 2) return;
    this.clearGuideArrows();

    const color = new BABYLON.Color3(0.95, 0.08, 0.08);

    // Los puntos ya vienen en coordenadas mundo (transformados desde el espacio local del OBJ
    // usando localToWorld() antes de llamar a este método). Se dibujan segmento a segmento.
    // Se iguala la Y de todos los waypoints intermedios a un valor sobre el suelo para
    // que la línea no atraviese el modelo.
    const floorY = Math.max(points[points.length - 1].y, 0.5);
    const leveledPoints: BABYLON.Vector3[] = points.map((p, i) =>
      i === points.length - 1
        ? p.clone()                                            // destino: respetar su Y real
        : new BABYLON.Vector3(p.x, floorY, p.z)              // waypoints intermedios: nivelados
    );

    // Insertar punto de codo en L antes del destino para evitar diagonales que cruzan paredes
    const worldPoints = this.insertElbowPoint(leveledPoints);

    const totalSegments = worldPoints.length - 1;

    const drawSegment = (i: number) => {
      if (!this.scene) return;
      const worldFrom = worldPoints[i];
      const worldTo = worldPoints[i + 1];

      const meshes = dibujarFlechaGuia(this.scene, worldFrom, worldTo, color);
      this.guideArrowMeshes.push(...meshes);

      if (i + 1 < totalSegments) {
        setTimeout(() => drawSegment(i + 1), 400);
      }
    };

    drawSegment(0);
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
    this.camera.radius = Math.max(4, this.camera.radius - 3);
    this.baseRadius = this.camera.radius;
    this.registerUserInteraction();
  }

  public zoomOut(): void {
    if (!this.camera) return;
    this.camera.radius = Math.min(200, this.camera.radius + 3);
    this.baseRadius = this.camera.radius;
    this.registerUserInteraction();
  }

  public resetCamera(): void {
    if (!this.camera) return;
    this.camera.target = new BABYLON.Vector3(0, 0, 0);
    this.camera.alpha = Math.PI / 4;
    this.camera.beta = Math.PI / 3;
    this.camera.radius = this.currentBuilding === 'A' ? 52 : (this.currentBuilding === 'S' ? 77 : 25);
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