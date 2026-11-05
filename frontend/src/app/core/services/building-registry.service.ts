import { Injectable } from '@angular/core';
import { BuildingDefinition, BuildingId, FloorDefinition } from '../models/navegacion.model';

@Injectable({
  providedIn: 'root'
})
export class BuildingRegistryService {
  private buildings: Map<string, BuildingDefinition> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Sede (Vista Global del Campus)
    this.register({
      id: 'S',
      name: 'Sede INACAP',
      center: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: -Math.PI / 2, z: 0 },
      floors: [
        {
          number: 1,
          label: 'Campus General',
          modelFile: 'Instituto3D-color.obj',
          modelDir: '/assets/3d-models/sede/',
          elevation: 0.05
        }
      ]
    });

    // Edificio A
    this.register({
      id: 'A',
      name: 'Edificio A',
      center: { x: 0, y: 0, z: 0 },
      rotation: { x: -Math.PI / 2, y: Math.PI, z: 0 },
      cameraBaseAlpha: Math.PI / 2,
      corridorAxis: 'x',
      corridorFixedCoord: 0.16,
      floors: [
        { number: 1, label: 'Piso 1', modelFile: 'Edifico A - Piso 1.obj', modelDir: '/assets/3d-models/Edificio A/', elevation: 0.05 },
        { number: 2, label: 'Piso 2', modelFile: 'Edificio A - piso 2.obj', modelDir: '/assets/3d-models/Edificio A/', elevation: 0.41 },
        { number: 3, label: 'Piso 3', modelFile: 'Edificio A - piso 3.obj', modelDir: '/assets/3d-models/Edificio A/', elevation: 0.86 }
      ],
      defaultStairs: [
        {
          nombre: 'Escalera Principal',
          worldPos: { x: 9.80, z: 0.16 },
          landing:   { x: 9.80, z: -0.80 },
          threshold: { x: 9.80, z: 0.16 }
        },
        {
          nombre: 'Escalera Secundaria',
          worldPos: { x: -9.21, z: -0.44 },
          landing:   { x: -9.21, z: 0.80 },
          threshold: { x: -9.21, z: -0.44 }
        }
      ]
    });

    // Edificio B
    this.register({
      id: 'B',
      name: 'Edificio B',
      center: { x: 38.8, y: 0, z: -10.4 },
      rotation: { x: -Math.PI / 2, y: Math.PI, z: 0 },
      scale: { x: 1.2, y: 1.2, z: 1.2 },
      cameraBaseAlpha: 0,
      corridorAxis: 'z',
      corridorFixedCoord: -0.50,
      floors: [
        { number: 1, label: 'Piso 1', modelFile: 'Edificio B - Piso 1.obj', modelDir: '/assets/3d-models/Edificio B/', elevation: 0.05 },
        { number: 2, label: 'Piso 2', modelFile: 'Edificio B - Piso 2.obj', modelDir: '/assets/3d-models/Edificio B/', elevation: 0.41 },
        { number: 3, label: 'Piso 3', modelFile: 'Edificio B - Piso 3.obj', modelDir: '/assets/3d-models/Edificio B/', elevation: 0.86 }
      ],
      defaultStairs: [
        {
          nombre: 'Escalera Edificio B',
          worldPos: { x: -0.49, z: -11.40 },
          landing:   { x: -0.49, z: -11.40 },
          threshold: { x: -0.50, z: -3.15 }
        }
      ]
    });

    // Edificio C
    this.register({
      id: 'C',
      name: 'Edificio C',
      center: { x: -52.0, y: 3.1, z: -15.0 },
      rotation: { x: 0, y: -Math.PI / 2, z: 0 },
      cameraBaseAlpha: Math.PI,
      corridorAxis: 'z',
      corridorFixedCoord: -2.40,
      floors: [
        { number: 1, label: 'Piso 1', modelFile: 'Edificio C - Piso 1.obj', modelDir: '/assets/3d-models/Edificio C/', elevation: 0.05 },
        { number: 2, label: 'Piso 2', modelFile: 'Edificio C - Piso 2.obj', modelDir: '/assets/3d-models/Edificio C/', elevation: 0.41 }
      ],
      defaultStairs: [
        {
          nombre: 'Escalera Edificio C',
          worldPos: { x: -2.20, z: 9.70 },
          landing:   { x: -2.20, z: 9.70 },
          threshold: { x: -2.40, z: 8.00 }
        }
      ]
    });

    // Edificio D
    this.register({
      id: 'D',
      name: 'Edificio D',
      center: { x: -54.0, y: 3.1, z: 7.0 },
      rotation: { x: 0, y: -Math.PI / 2, z: 0 },
      cameraBaseAlpha: 0,
      corridorAxis: 'z',
      corridorFixedCoord: -0.05,
      floors: [
        { number: 1, label: 'Piso 1', modelFile: 'Edificio D - Piso1.obj', modelDir: '/assets/3d-models/Edificio D/', elevation: 0.05 },
        { number: 2, label: 'Piso 2', modelFile: 'Edificio D - Piso 2.obj', modelDir: '/assets/3d-models/Edificio D/', elevation: 0.41 }
      ],
      defaultStairs: [
        {
          nombre: 'Escalera Edificio D',
          worldPos: { x: -1.00, z: 7.30 },
          landing:   { x: -1.00, z: 7.30 },
          threshold: { x: -0.05, z: 7.30 }
        }
      ]
    });

    // Edificio E
    this.register({
      id: 'E',
      name: 'Edificio E',
      center: { x: -55.0, y: 3.1, z: 30.0 },
      rotation: { x: 0, y: -Math.PI / 2, z: 0 },
      cameraBaseAlpha: 0,
      corridorAxis: 'z',
      corridorFixedCoord: -0.05,
      floors: [
        { number: 1, label: 'Piso 1', modelFile: 'Edificio E - Piso1 con Letras.obj', modelDir: '/assets/3d-models/Edificio E/', elevation: 0.05 },
        { number: 2, label: 'Piso 2', modelFile: 'Edificio E - Piso2 con Letras.obj', modelDir: '/assets/3d-models/Edificio E/', elevation: 0.41 }
      ],
      defaultStairs: [
        {
          nombre: 'Escalera Edificio E',
          worldPos: { x: -1.00, z: 7.00 },
          landing:   { x: -1.00, z: 7.00 },
          threshold: { x: -0.05, z: 7.00 }
        }
      ]
    });
  }

  public register(def: BuildingDefinition): void {
    this.buildings.set((def.id || '').toUpperCase(), def);
  }

  public getBuilding(id: string | null | undefined): BuildingDefinition | undefined {
    if (!id) return undefined;
    return this.buildings.get(id.toUpperCase());
  }

  public getAllBuildings(): BuildingDefinition[] {
    return Array.from(this.buildings.values());
  }

  public getNavigableBuildings(): BuildingDefinition[] {
    return this.getAllBuildings().filter(b => b.id !== 'S');
  }

  public getFloorsForBuilding(buildingId: string | null | undefined): FloorDefinition[] {
    const bld = this.getBuilding(buildingId);
    return bld ? bld.floors : [];
  }

  public getFloor(buildingId: string | null | undefined, floorOrModel: string | number | null | undefined): FloorDefinition | undefined {
    if (floorOrModel == null) return undefined;
    const floors = this.getFloorsForBuilding(buildingId);
    if (typeof floorOrModel === 'number') {
      return floors.find(f => f.number === floorOrModel);
    }
    const cleanStr = floorOrModel.toString().trim();
    // 1. Por coincidencia exacta de nombre de archivo
    const byFile = floors.find(f => f.modelFile.toLowerCase() === cleanStr.toLowerCase());
    if (byFile) return byFile;

    // 2. Por número contenido en string (ej. 'Piso 2' -> 2)
    const num = parseInt(cleanStr.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
      const byNum = floors.find(f => f.number === num);
      if (byNum) return byNum;
    }

    // 3. Por etiqueta (ej. 'Piso 1')
    return floors.find(f => f.label.toLowerCase() === cleanStr.toLowerCase());
  }

  public resolveFloorModel(buildingId: string | null | undefined, floor: string | number | null | undefined): string {
    const found = this.getFloor(buildingId, floor);
    if (found) return found.modelFile;
    if (buildingId === 'S') return 'Instituto3D-color.obj';
    return `Edificio ${buildingId} - Piso ${floor}.obj`;
  }

  public getFloorElevation(piso: string | number | null | undefined, buildingId?: string): number {
    if (piso == null) return 0.05;
    if (buildingId) {
      const f = this.getFloor(buildingId, piso);
      if (f && f.elevation !== undefined) return f.elevation;
    }
    const str = piso.toString().toLowerCase();
    if (str.includes('3')) return 0.86;
    if (str.includes('2')) return 0.41;
    return 0.05;
  }

  public getDefaultStairs(buildingId: string | null | undefined): any[] {
    const bld = this.getBuilding(buildingId);
    return bld?.defaultStairs || [];
  }
}
