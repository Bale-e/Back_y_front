/**
 * Servicio para renderizar a Inacapito caminando a lo largo de las rutas de navegación en BabylonJS.
 * Reemplaza la flecha estática (cono y tubo) por el modelo 3D animado de Inacapito que camina
 * guiando al usuario paso a paso hacia su destino.
 */
import { Injectable, NgZone } from '@angular/core';
import * as BABYLON from 'babylonjs';

export const INACAPITO_MODEL_URL = 'assets/3d-models/Inacapito/inacapito_walking.glb';
export const INACAPITO_DEFAULT_SCALE = 22; // Altura ~0.29 unidades, escala humana en el mapa 3D
export const ROUTE_LINE_COLOR = new BABYLON.Color3(0.92, 0.12, 0.12);

@Injectable({
  providedIn: 'root'
})
export class InacapitoGuideService {
  private containerCache: BABYLON.AssetContainer | null = null;
  private isCacheLoading = false;

  // Instancia activa en la escena
  private activeRootNode: BABYLON.TransformNode | null = null;
  private activeMeshes: BABYLON.AbstractMesh[] = [];
  private activeAnimationGroup: BABYLON.AnimationGroup | null = null;
  private shadowDisc: BABYLON.AbstractMesh | null = null;

  // Meshes de la línea de ruta en el piso
  private groundLineMeshes: BABYLON.AbstractMesh[] = [];

  // Puntos del recorrido actual
  private currentWorldPoints: BABYLON.Vector3[] = [];
  private activeStepIndex = 0;
  private isCurrentEntranceTransition = false;

  // Control de animación de movimiento
  private walkObserver: BABYLON.Observer<BABYLON.Scene> | null = null;
  private loopTimeoutId: any = null;
  private currentScene: BABYLON.Scene | null = null;

  constructor(private ngZone: NgZone) {}

  /**
   * Pre-carga el modelo glTF de Inacapito si aún no está en cache.
   */
  public async preloadModel(scene: BABYLON.Scene): Promise<void> {
    if (this.containerCache || this.isCacheLoading) return;
    try {
      this.isCacheLoading = true;
      const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
        '',
        INACAPITO_MODEL_URL,
        scene
      );
      this.containerCache = container;
    } catch (err) {
      console.warn('InacapitoGuideService: No se pudo pre-cargar el modelo de Inacapito:', err);
    } finally {
      this.isCacheLoading = false;
    }
  }

  /**
   * Dibuja la ruta y posiciona a Inacapito al inicio.
   * Retorna los meshes generados (líneas de piso + personaje) para que el llamador pueda
   * gestionar visibilidad/fadeouts durante transiciones de piso.
   * @param isEntranceTransition Si es true, activa una zancada y onda de aparición de portal
   */
  public async setupRoute(
    scene: BABYLON.Scene,
    worldPoints: BABYLON.Vector3[],
    isEntranceTransition = false
  ): Promise<BABYLON.AbstractMesh[]> {
    this.clear();
    this.currentScene = scene;
    this.currentWorldPoints = worldPoints.map(p => p.clone());
    this.isCurrentEntranceTransition = isEntranceTransition;

    if (worldPoints.length < 2) {
      return [];
    }

    const createdMeshes: BABYLON.AbstractMesh[] = [];

    // 1. Crear líneas del camino en el piso (tubos delgados y elegantes, sin conos gigantes)
    const totalSegments = worldPoints.length - 1;
    for (let i = 0; i < totalSegments; i++) {
      const from = worldPoints[i];
      const to   = worldPoints[i + 1];

      const segmentPath = [from, to];
      const tube = BABYLON.MeshBuilder.CreateTube(`inacapitoRouteTube_${i}`, {
        path: segmentPath,
        radius: 0.04,
        tessellation: 8,
        cap: BABYLON.Mesh.CAP_ALL,
        updatable: false
      }, scene);

      const mat = new BABYLON.StandardMaterial(`inacapitoRouteMat_${i}`, scene);
      mat.diffuseColor = ROUTE_LINE_COLOR;
      mat.emissiveColor = ROUTE_LINE_COLOR;
      mat.specularColor = BABYLON.Color3.Black();
      mat.alpha = 0.85;

      tube.material = mat;
      tube.isPickable = false;
      tube.checkCollisions = false;
      tube.renderingGroupId = 1;

      this.groundLineMeshes.push(tube);
      createdMeshes.push(tube);
    }

    // 2. Cargar o instanciar a Inacapito
    try {
      if (!this.containerCache) {
        this.containerCache = await BABYLON.SceneLoader.LoadAssetContainerAsync(
          '',
          INACAPITO_MODEL_URL,
          scene
        );
      }

      const entries = this.containerCache.instantiateModelsToScene(
        name => `inacapito_${name}`,
        false,
        { doNotInstantiate: false }
      );

      this.activeMeshes = entries.rootNodes
        .filter(n => n instanceof BABYLON.AbstractMesh) as BABYLON.AbstractMesh[];
      createdMeshes.push(...this.activeMeshes);

      // Root de Inacapito para mover y rotar con libertad
      const rootNode = new BABYLON.TransformNode('inacapitoGuideRoot', scene);
      this.activeRootNode = rootNode;

      entries.rootNodes.forEach(rn => {
        rn.parent = rootNode;
        rn.getChildMeshes().forEach(m => {
          m.renderingGroupId = 1;
          m.isPickable = false;
          createdMeshes.push(m);
          if (m.material && m.material instanceof BABYLON.PBRMaterial) {
            m.material.emissiveColor = new BABYLON.Color3(0.12, 0.12, 0.12);
          }
        });
      });

      // Escalar al tamaño proporcional humano en la maqueta
      const scale = INACAPITO_DEFAULT_SCALE;
      rootNode.scaling = new BABYLON.Vector3(scale, scale, scale);

      // Sombra/resplandor en los pies para que se vea perfectamente apoyado en el piso
      const shadow = BABYLON.MeshBuilder.CreateDisc('inacapitoShadow', {
        radius: 0.22,
        tessellation: 24
      }, scene);
      shadow.rotation.x = Math.PI / 2;
      shadow.position.y = 0.01;
      shadow.parent = rootNode;

      const shadowMat = new BABYLON.StandardMaterial('inacapitoShadowMat', scene);
      shadowMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.12);
      shadowMat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.08);
      shadowMat.specularColor = BABYLON.Color3.Black();
      shadowMat.alpha = 0.45;
      shadow.material = shadowMat;
      shadow.isPickable = false;
      shadow.renderingGroupId = 1;
      this.shadowDisc = shadow;
      createdMeshes.push(shadow);

      // Configurar animación de caminar
      if (entries.animationGroups.length > 0) {
        this.activeAnimationGroup = entries.animationGroups[0];
        this.activeAnimationGroup.speedRatio = 1.15; // Ritmo ágil y natural
      }

      // Posicionar en el punto inicial de la ruta
      const startPoint = worldPoints[0];
      rootNode.position.copyFrom(startPoint);

      if (worldPoints.length > 1) {
        const nextPoint = worldPoints[1];
        const lookTarget = new BABYLON.Vector3(nextPoint.x, startPoint.y, nextPoint.z);
        rootNode.lookAt(lookTarget);
      }

      if (this.isCurrentEntranceTransition) {
        this.triggerEntrancePortalEffect(startPoint, scene);
      }
    } catch (err) {
      console.error('InacapitoGuideService: Error al instanciar Inacapito:', err);
    }

    return createdMeshes;
  }

  /**
   * Muestra y anima a Inacapito a lo largo del segmento indicado.
   * Mientras el usuario permanece en ese paso, Inacapito camina en bucle
   * demostrando la dirección. Al avanzar al siguiente paso, Inacapito
   * cambia al nuevo tramo inmediatamente.
   */
  public goToStep(
    stepIndex: number,
    totalSegments: number,
    onSegmentDrawn?: (
      segmentIndex: number,
      totalSegments: number,
      midpoint: BABYLON.Vector3,
      isLast: boolean
    ) => void
  ): void {
    this.activeStepIndex = stepIndex;
    const clampedIdx = Math.max(0, Math.min(stepIndex, this.currentWorldPoints.length - 2));
    const isLast = (stepIndex + 1) >= totalSegments;

    // Resaltar el segmento activo en la línea del suelo
    this.groundLineMeshes.forEach((mesh, idx) => {
      if (mesh.material && mesh.material instanceof BABYLON.StandardMaterial) {
        mesh.material.alpha = (idx === clampedIdx) ? 1.0 : 0.35;
      }
    });

    if (this.currentWorldPoints.length < 2) return;

    const from = this.currentWorldPoints[clampedIdx];
    const to   = this.currentWorldPoints[clampedIdx + 1];

    if (onSegmentDrawn) {
      const midpoint = new BABYLON.Vector3(
        (from.x + to.x) / 2,
        (from.y + to.y) / 2,
        (from.z + to.z) / 2
      );
      onSegmentDrawn(clampedIdx, totalSegments, midpoint, isLast);
    }

    if (!this.activeRootNode) return;

    if (isLast) {
      // Último paso: Inacapito se ubica en el destino y descansa de pie
      this.stopCurrentWalk();
      this.activeRootNode.position.copyFrom(to);
      if (this.activeAnimationGroup) {
        this.activeAnimationGroup.stop();
      }
      return;
    }

    // Iniciar caminata animada a lo largo del segmento
    this.startSegmentWalk(from, to, clampedIdx);
  }

  /**
   * Anima a Inacapito caminando de 'from' a 'to'. Si el usuario no cambia de paso,
   * al llegar a 'to' espera brevemente y repite el tramo para seguir indicando la ruta.
   */
  private startSegmentWalk(from: BABYLON.Vector3, to: BABYLON.Vector3, expectedStepIdx: number): void {
    this.stopCurrentWalk();

    if (!this.activeRootNode || !this.currentScene) return;

    const rootNode = this.activeRootNode;
    const scene = this.currentScene;

    // Orientar a Inacapito hacia el destino del segmento (manteniendo eje Y)
    const lookTarget = new BABYLON.Vector3(to.x, from.y, to.z);
    rootNode.position.copyFrom(from);
    rootNode.lookAt(lookTarget);

    // Iniciar la animación de caminar
    if (this.activeAnimationGroup && !this.activeAnimationGroup.isPlaying) {
      this.activeAnimationGroup.play(true);
    }

    const distance = BABYLON.Vector3.Distance(from, to);
    const speed = 1.6; // unidades por segundo
    const durationMs = Math.max(1200, Math.min(4500, (distance / speed) * 1000));

    let startTime = performance.now();

    this.walkObserver = scene.onBeforeRenderObservable.add(() => {
      // Verificar si el paso sigue siendo el actual
      if (this.activeStepIndex !== expectedStepIdx) {
        this.stopCurrentWalk();
        return;
      }

      const elapsed = performance.now() - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);

      // Interpolación lineal de la posición
      rootNode.position.x = from.x + (to.x - from.x) * progress;
      rootNode.position.y = from.y + (to.y - from.y) * progress;
      rootNode.position.z = from.z + (to.z - from.z) * progress;

      // Zancada de entrada natural al aparecer desde el conector inter-edificio
      if (this.isCurrentEntranceTransition && expectedStepIdx === 0) {
        const entranceFactor = Math.min(1.0, progress / 0.35);
        const curScale = INACAPITO_DEFAULT_SCALE * (0.82 + 0.18 * entranceFactor);
        rootNode.scaling.set(curScale, curScale, curScale);
      }

      if (progress >= 1.0) {
        // Llegó al final del segmento
        this.stopCurrentWalk();

        // Si el usuario aún sigue en este paso, pausar un momento y reiniciar
        this.loopTimeoutId = setTimeout(() => {
          if (this.activeStepIndex === expectedStepIdx && this.activeRootNode) {
            this.startSegmentWalk(from, to, expectedStepIdx);
          }
        }, 600);
      }
    });
  }

  /**
   * Genera un efecto de onda expansiva translúcida en los pies al emerger por el punto de acceso.
   */
  private triggerEntrancePortalEffect(point: BABYLON.Vector3, scene: BABYLON.Scene): void {
    try {
      const ring = BABYLON.MeshBuilder.CreateTorus('entrancePortalRing', {
        diameter: 0.6,
        thickness: 0.04,
        tessellation: 32
      }, scene);
      ring.position = new BABYLON.Vector3(point.x, point.y + 0.04, point.z);
      ring.rotation.x = Math.PI / 2;

      const ringMat = new BABYLON.StandardMaterial('entrancePortalRingMat', scene);
      ringMat.diffuseColor = new BABYLON.Color3(0.15, 0.75, 1.0);
      ringMat.emissiveColor = new BABYLON.Color3(0.2, 0.85, 1.0);
      ringMat.specularColor = BABYLON.Color3.Black();
      ringMat.alpha = 0.9;
      ring.material = ringMat;
      ring.renderingGroupId = 1;
      ring.isPickable = false;

      const startTime = performance.now();
      const duration = 1200;
      const observer = scene.onBeforeRenderObservable.add(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        const scale = 1.0 + progress * 2.5;
        ring.scaling.set(scale, scale, 1.0);
        ringMat.alpha = (1.0 - progress) * 0.9;
        if (progress >= 1.0) {
          scene.onBeforeRenderObservable.remove(observer);
          ring.dispose();
          ringMat.dispose();
        }
      });
    } catch (err) {
      console.warn('InacapitoGuideService: Error al generar efecto de portal:', err);
    }
  }

  /**
   * Detiene el observador de caminata actual y timers pendientes.
   */
  private stopCurrentWalk(): void {
    if (this.walkObserver && this.currentScene) {
      this.currentScene.onBeforeRenderObservable.remove(this.walkObserver);
      this.walkObserver = null;
    }
    if (this.loopTimeoutId) {
      clearTimeout(this.loopTimeoutId);
      this.loopTimeoutId = null;
    }
  }

  /**
   * Retorna la cantidad de segmentos de la ruta cargada.
   */
  public getSegmentCount(): number {
    return Math.max(0, this.currentWorldPoints.length - 1);
  }

  /**
   * Limpia y desecha todos los meshes y animaciones activas.
   */
  public clear(): void {
    this.stopCurrentWalk();

    if (this.activeAnimationGroup) {
      this.activeAnimationGroup.stop();
      this.activeAnimationGroup.dispose();
      this.activeAnimationGroup = null;
    }

    if (this.shadowDisc) {
      this.shadowDisc.dispose();
      this.shadowDisc = null;
    }

    if (this.activeRootNode) {
      this.activeRootNode.dispose(false, true);
      this.activeRootNode = null;
    }

    this.activeMeshes.forEach(m => {
      if (!m.isDisposed()) m.dispose();
    });
    this.activeMeshes = [];

    this.groundLineMeshes.forEach(m => {
      if (!m.isDisposed()) m.dispose();
    });
    this.groundLineMeshes = [];

    this.currentWorldPoints = [];
    this.activeStepIndex = 0;
    this.currentScene = null;
  }
}
