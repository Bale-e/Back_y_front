/**
 * Utilidades para dibujar flechas guía de navegación en la escena BabylonJS.
 * Antes: flecha_guía.ts  →  Renombrado a: guide-arrow.service.ts
 */
import * as BABYLON from 'babylonjs';

// Color rojo estándar para el corredor principal
export const ROUTE_COLOR_CORRIDOR = new BABYLON.Color3(0.95, 0.05, 0.05);
// Color rojo oscuro para el desvío final
export const ROUTE_COLOR_TURN = new BABYLON.Color3(0.85, 0.15, 0.15);

export function dibujarFlechaGuia(
  scene: BABYLON.Scene,
  origen: BABYLON.Vector3,
  destino: BABYLON.Vector3,
  color: BABYLON.Color3 = ROUTE_COLOR_CORRIDOR
): BABYLON.AbstractMesh[] {
  const meshes: BABYLON.AbstractMesh[] = [];

  const dir = destino.subtract(origen);
  const length = dir.length();
  if (length < 0.01) return meshes;

  // ── Tubo en lugar de línea para mayor visibilidad ─────────────────────────
  const path = [origen, destino];
  const tube = BABYLON.MeshBuilder.CreateTube('guideTube', {
    path,
    radius: 0.07,
    tessellation: 6,
    cap: BABYLON.Mesh.CAP_ALL,
    updatable: false
  }, scene);

  const tubeMat = new BABYLON.StandardMaterial('guideTubeMat', scene);
  tubeMat.diffuseColor = color;
  tubeMat.emissiveColor = color;
  tubeMat.specularColor = BABYLON.Color3.Black();
  tube.material = tubeMat;
  tube.isPickable = false;
  tube.checkCollisions = false;
  tube.renderingGroupId = 1;
  meshes.push(tube);

  // ── Cabeza de flecha (cono) ────────────────────────────────────────────────
  const arrowMat = new BABYLON.StandardMaterial('guideArrowMat', scene);
  arrowMat.diffuseColor = color;
  arrowMat.emissiveColor = color;
  arrowMat.specularColor = BABYLON.Color3.Black();

  // Posición a 2/3 del recorrido para que la punta señale al frente
  const pos = origen.add(dir.scale(0.75));
  const head = BABYLON.MeshBuilder.CreateCylinder('guideArrowHead', {
    height: Math.min(1.5, Math.max(0.5, length * 0.3)),
    diameterTop: 0,
    diameterBottom: Math.min(0.55, Math.max(0.2, length * 0.1))
  }, scene);
  head.material = arrowMat;
  head.position = pos;
  head.lookAt(destino);
  head.rotate(new BABYLON.Vector3(1, 0, 0), Math.PI / 2, BABYLON.Space.LOCAL);
  head.isPickable = false;
  head.checkCollisions = false;
  head.renderingGroupId = 1;
  meshes.push(head);

  return meshes;
}
