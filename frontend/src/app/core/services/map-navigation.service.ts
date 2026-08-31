import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as BABYLON from 'babylonjs';
import { Firebase } from '../../services/firebase';
import { BuildingId, SelectedLocationInfo } from '../models/navigation.model';
import { buildRoute, findDestinationInPaths } from '../../services/route-finder.service';

@Injectable({
  providedIn: 'root'
})
export class MapNavigationService {
  private currentBuildingSubject = new BehaviorSubject<BuildingId>('A');
  public currentBuilding$ = this.currentBuildingSubject.asObservable();

  private currentFloorSubject = new BehaviorSubject<string>('Edifico A - Piso 1.obj');
  public currentFloor$ = this.currentFloorSubject.asObservable();

  private selectedLocationSubject = new BehaviorSubject<SelectedLocationInfo | null>(null);
  public selectedLocation$ = this.selectedLocationSubject.asObservable();

  private destinationsSubject = new BehaviorSubject<string[]>([]);
  public destinations$ = this.destinationsSubject.asObservable();

  private readonly infoDataMap: Record<string, SelectedLocationInfo> = {
    'Cuerpo13': { nombre: 'Fotocopiadora y Suministros', desc: 'Servicio de fotocopiado y venta de materiales para estudiantes.' },
    'Cuerpo29': { nombre: 'Sala de Tutorías 1', desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo30': { nombre: 'Sala de Tutorías 2', desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo28': { nombre: 'Sala de Tutorías 3', desc: 'Espacio adicional de tutorías con capacidad para grupos pequeños.' },
    'Cuerpo27': { nombre: 'Sala de Tutorías 4', desc: 'Sala de apoyo académico y reuniones estudiantiles.' },
    'Cuerpo20': { nombre: 'Sala A106', desc: 'Espacio académico del Edificio A, piso 1.' },
    'cuerpo20': { nombre: 'Sala A106', desc: 'Espacio académico del Edificio A, piso 1.' }
  };

  private getFloorSpecificInfo(meshName: string): SelectedLocationInfo | null {
    const normalizedMeshName = (meshName || '').replace(/\s+/g, '').toLowerCase();
    const floorText = this.currentFloorSubject.value.toLowerCase();
    const isSecondFloor = floorText.includes('piso2') || floorText.includes('2');
    const isThirdFloor = floorText.includes('piso3') || floorText.includes('3');

    const overrides: Record<string, { firstFloor?: SelectedLocationInfo; secondFloor?: SelectedLocationInfo; thirdFloor?: SelectedLocationInfo }> = {
      cuerpo20: {
        firstFloor: { nombre: 'Sala A106', desc: 'Espacio académico del Edificio A, piso 1.' },
        secondFloor: { nombre: 'Sala A202', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A309', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo3: {
        firstFloor: { nombre: 'Sala A101', desc: 'Espacio académico del Edificio A, piso 1.' },
        secondFloor: { nombre: 'Sala A216', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A311', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo1: {
        secondFloor: { nombre: 'Sala A218', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A308', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo13: {
        secondFloor: { nombre: 'Sala 203', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Baño de Dama', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo10: { thirdFloor: { nombre: 'Sala A302', desc: 'Espacio académico del Edificio A, piso 3.' } },
      cuerpo11: {
        secondFloor: { nombre: 'Sala A213', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A306', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo12: {
        secondFloor: { nombre: 'Sala A207', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A310', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo7: {
        secondFloor: { nombre: 'Sala A209', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A318', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo21: { thirdFloor: { nombre: 'Sala A301', desc: 'Espacio académico del Edificio A, piso 3.' } },
      cuerpo23: { thirdFloor: { nombre: 'Sala A312', desc: 'Espacio académico del Edificio A, piso 3.' } },
      cuerpo55: {
        secondFloor: { nombre: 'Sala A208', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A314', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo19: { secondFloor: { nombre: 'Sala A205', desc: 'Espacio académico del Edificio A, piso 2.' } },
      cuerpo18: { secondFloor: { nombre: 'Sala A215', desc: 'Espacio académico del Edificio A, piso 2.' } },
      cuerpo2: { thirdFloor: { nombre: 'Baño de Varones', desc: 'Espacio académico del Edificio A, piso 3.' } },
      cuerpo15: { secondFloor: { nombre: 'Sala A204', desc: 'Espacio académico del Edificio A, piso 2.' } },
      cuerpo17: {
        firstFloor: { nombre: 'Sala A113', desc: 'Espacio académico del Edificio A, piso 1.' },
        secondFloor: { nombre: 'Sala A206', desc: 'Espacio académico del Edificio A, piso 2.' }
      },
      cuerpo9: {
        secondFloor: { nombre: 'Sala A2010', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A311', desc: 'Espacio académico del Edificio A, piso 3.' }
      }
    };

    const override = overrides[normalizedMeshName];
    if (!override) {
      return null;
    }

    if (this.currentBuildingSubject.value === 'B' && isThirdFloor) {
      const bThirdFloorOverrides: Record<string, SelectedLocationInfo> = {
        cuerpo1: { nombre: 'Sala B304', desc: 'Espacio académico del Edificio B, piso 3.' },
        cuerpo2: { nombre: 'Sala B303', desc: 'Espacio académico del Edificio B, piso 3.' },
        cuerpo3: { nombre: 'Sala B305', desc: 'Espacio académico del Edificio B, piso 3.' },
        cuerpo4: { nombre: 'Sala B306', desc: 'Espacio académico del Edificio B, piso 3.' },
        cuerpo5: { nombre: 'Sala B302', desc: 'Espacio académico del Edificio B, piso 3.' },
        cuerpo6: { nombre: 'Sala B307', desc: 'Espacio académico del Edificio B, piso 3.' },
        cuerpo7: { nombre: 'Sala B308', desc: 'Espacio académico del Edificio B, piso 3.' },
        cuerpo8: { nombre: 'Sala B301', desc: 'Espacio académico del Edificio B, piso 3.' }
      };
      const bOverride = bThirdFloorOverrides[normalizedMeshName];
      if (bOverride) {
        return bOverride;
      }
    }

    if (this.currentBuildingSubject.value === 'B' && normalizedMeshName === 'cuerpo7' && isSecondFloor) {
      return { nombre: 'Sala B308', desc: 'Espacio académico del Edificio B, piso 2.' };
    }

    if (isThirdFloor) {
      return override.thirdFloor ?? null;
    }
    return isSecondFloor ? override.secondFloor ?? null : override.firstFloor ?? null;
  }

  constructor(private firebaseService: Firebase) {}

  public setBuilding(building: BuildingId): void {
    this.currentBuildingSubject.next(building);
  }

  public setFloor(floorModel: string): void {
    this.currentFloorSubject.next(floorModel);
  }

  public setSelectedLocation(location: SelectedLocationInfo | null): void {
    this.selectedLocationSubject.next(location);
  }

  private cachedLocations: any[] = [];

  public async getLocationInfoByMeshNameAsync(meshName: string): Promise<SelectedLocationInfo | null> {
    const normalizedMeshName = (meshName || '').replace(/\s+/g, '').toLowerCase();
    const isBackgroundMesh = (normalizedMeshName.includes('untitled') || normalizedMeshName.includes('fixed') || normalizedMeshName.includes('sede') || normalizedMeshName === 'ground' || normalizedMeshName === 'suelo')
      && !/^cuerpo\d+/i.test(normalizedMeshName);

    if (isBackgroundMesh) {
      return null;
    }
    const floorSpecificInfo = this.getFloorSpecificInfo(meshName);
    const infoDataEntry = floorSpecificInfo || this.infoDataMap[meshName] || this.infoDataMap[normalizedMeshName] || this.infoDataMap[normalizedMeshName.toLowerCase()];
    if (infoDataEntry) {
      return infoDataEntry;
    }
    const cleanName = meshName.replace(/\s+/g, '');
    const match = cleanName.match(/^cuerpo(\d+)/i);
    if (match) {
      const cuerpoNum = parseInt(match[1], 10);
      try {
        if (this.cachedLocations.length === 0) {
          this.cachedLocations = await this.firebaseService.getLocacionesDeTodosLosEdificios();
        }
        const currentBld = this.currentBuildingSubject.value;
        const currentFloor = this.currentFloorSubject.value.toLowerCase();

        const found = this.cachedLocations.find((loc: any) => {
          const locCuerpo = loc.Cuerpo ?? loc.cuerpo;
          if (locCuerpo === cuerpoNum || parseInt(locCuerpo, 10) === cuerpoNum) {
            const locBuilding = (loc._edificioId || loc.Edificio || loc.edificio || '').toString().toLowerCase();
            const locFloor = (loc.Piso || loc.piso || '').toString().toLowerCase().replace(/\s+/g, '');
            const matchBuilding = currentBld === 'S' || locBuilding.includes(currentBld.toLowerCase()) || locBuilding === currentBld.toLowerCase();
            const matchFloor = currentBld === 'S' || currentFloor.replace(/\s+/g, '').includes(locFloor) || locFloor.includes(currentFloor.replace(/\s+/g, ''));
            return matchBuilding && matchFloor;
          }
          return false;
        });

        if (found) {
          const name = found.Nombre || found.nombre || `Cuerpo ${cuerpoNum}`;
          const tipo = found.Tipo || found.tipo || 'Espacio académico';
          const floorStr = found.Piso || found.piso || 'Piso 1';
          return {
            nombre: name,
            desc: `${tipo} — Ubicado en Edificio ${found.Edificio || currentBld}, ${floorStr}.`,
            edificio: found.Edificio || currentBld,
            piso: floorStr
          };
        }
      } catch (err) {
        console.warn('Error al buscar info por meshName:', err);
      }

      return {
        nombre: `Cuerpo ${match[1]}`,
        desc: `Espacio de la sede Inacap. Información e indicaciones disponibles para Cuerpo ${match[1]}.`,
        edificio: this.currentBuildingSubject.value,
        piso: this.currentFloorSubject.value
      };
    }
    return null;
  }

  public async findNearestLocationByCoords(point: any, buildingFilter?: string, maxDistance = 80): Promise<SelectedLocationInfo | null> {
    try {
      if (this.cachedLocations.length === 0) {
        this.cachedLocations = await this.firebaseService.getLocacionesDeTodosLosEdificios();
      }

      let nearestLoc: any = null;
      let minDistance = Infinity;

      for (const loc of this.cachedLocations) {
        if (buildingFilter === 'S') {
          const locBuilding = (loc._edificioId || loc.Edificio || loc.edificio || '').toString().toUpperCase();
          if (locBuilding && locBuilding !== 'S' && locBuilding !== 'SEDE') {
            if (!loc.Cuerpo && !loc.cuerpo) continue;
          }
        }

        const vec = this.extractVec3(loc);
        if (vec) {
          const dist = BABYLON.Vector3.Distance(point, vec);
          if (dist < minDistance && dist <= maxDistance) {
            minDistance = dist;
            nearestLoc = loc;
          }
        }
      }

      if (nearestLoc) {
        const cuerpoNum = nearestLoc.Cuerpo ?? nearestLoc.cuerpo;
        let name = nearestLoc.Nombre || nearestLoc.nombre;
        if (buildingFilter === 'S' || !name) {
          name = cuerpoNum ? `Cuerpo ${cuerpoNum}` : (name || 'Cuerpo Inacap');
        }
        const tipo = nearestLoc.Tipo || nearestLoc.tipo || 'Espacio académico';
        const edificio = nearestLoc.Edificio || nearestLoc._edificioId || 'S';
        const piso = nearestLoc.Piso || nearestLoc.piso || 'General';

        return {
          nombre: name,
          desc: `${tipo} — ${edificio ? 'Edificio ' + edificio : 'Sede Inacap'}${piso ? ', ' + piso : ''}.`,
          edificio,
          piso
        };
      }
    } catch (err) {
      console.warn('Error al buscar locación cercana por coordenadas:', err);
    }
    return null;
  }

  public getLocationInfoByMeshName(meshName: string): SelectedLocationInfo | null {
    const normalizedMeshName = (meshName || '').replace(/\s+/g, '').toLowerCase();
    const isBackgroundMesh = (normalizedMeshName.includes('untitled') || normalizedMeshName.includes('fixed') || normalizedMeshName.includes('sede') || normalizedMeshName === 'ground' || normalizedMeshName === 'suelo')
      && !/^cuerpo\d+/i.test(normalizedMeshName);

    if (isBackgroundMesh) {
      return null;
    }
    const floorSpecificInfo = this.getFloorSpecificInfo(meshName);
    if (floorSpecificInfo) {
      return floorSpecificInfo;
    }
    if (this.infoDataMap[meshName]) {
      return this.infoDataMap[meshName];
    }
    const cleanName = meshName.replace(/\s+/g, '');
    if (/^cuerpo/i.test(cleanName)) {
      const match = cleanName.match(/^cuerpo(\d+)/i);
      const title = match ? `Cuerpo ${match[1]}` : meshName;
      return {
        nombre: title,
        desc: `Espacio de la sede Inacap. Información e indicaciones disponibles para ${title}.`,
        edificio: this.currentBuildingSubject.value,
        piso: this.currentFloorSubject.value
      };
    }
    return null;
  }

  public async loadDestinations(): Promise<string[]> {
    try {
      const locaciones = await this.firebaseService.getLocacionesDeTodosLosEdificios();
      this.cachedLocations = locaciones;
      const names = locaciones
        .map((loc: any) => loc.Nombre || loc.nombre)
        .filter((name: string) => typeof name === 'string' && name.trim() !== '');

      const uniqueNames = Array.from(new Set(names));
      this.destinationsSubject.next(uniqueNames as string[]);
      return uniqueNames as string[];
    } catch (error) {
      console.error('Error al cargar destinos:', error);
      return [];
    }
  }

  public async findLocationByName(destinationName: string): Promise<any | null> {
    try {
      if (this.cachedLocations.length === 0) {
        this.cachedLocations = await this.firebaseService.getLocacionesDeTodosLosEdificios();
      }
      const target = this.cachedLocations.find((loc: any) => {
        const name = (loc.Nombre || loc.nombre || '').trim().toLowerCase();
        return name === destinationName.trim().toLowerCase();
      });
      return target || null;
    } catch (err) {
      console.error('Error buscando locación:', err);
      return null;
    }
  }

  public extractVec3(obj: any): BABYLON.Vector3 | null {
    if (!obj || typeof obj !== 'object') return null;
    const nested =
      obj['Coordenadas3D'] ?? obj['Coordenadas 3D'] ??
      obj['Coordenadas'] ?? obj['coordenadas'] ??
      obj['coordinates'] ?? obj['coords'] ?? null;
    const src = nested ?? obj;

    const getField = (o: any, f: string) => {
      const k = Object.keys(o || {}).find(key => key.toLowerCase() === f.toLowerCase());
      return k ? parseFloat(o[k]) : null;
    };

    const x = getField(src, 'x');
    const y = getField(src, 'y');
    const z = getField(src, 'z');

    if (x != null && !isNaN(x) && y != null && !isNaN(y) && z != null && !isNaN(z)) {
      return new BABYLON.Vector3(x, y, z);
    }
    return null;
  }

  private getPisoFromLoc(loc: any): string {
    if (!loc) return 'Piso 1';
    const raw = loc.Piso ?? loc.piso ?? loc.floor ?? loc.Floor ?? loc._coleccionPiso;
    if (!raw) return 'Piso 1';
    const str = raw.toString().trim();
    if (/^\d+$/.test(str)) return `Piso ${str}`;
    if (/^piso\s*\d+/i.test(str)) {
      const num = str.replace(/[^0-9-]/g, '');
      return `Piso ${num}`;
    }
    return str;
  }

  public async calculateRoute(
    destinationName: string,
    meshPositionGetter?: (locName: string, cuerpoId?: string) => BABYLON.Vector3 | null
  ): Promise<{
    coord: BABYLON.Vector3;
    routePoints: BABYLON.Vector3[];
    statusText: string;
    piso: string;
    edificio: BuildingId;
  } | null> {
    const loc = await this.findLocationByName(destinationName);
    if (!loc) {
      return null;
    }

    const piso = this.getPisoFromLoc(loc);
    const edificioField = loc._edificioNombre || loc.Edificio || loc.edificio || 'A';
    const edificio: BuildingId = /b/i.test(edificioField) ? 'B' : /s|sede/i.test(edificioField) ? 'S' : 'A';
    const cuerpoNum = loc.Cuerpo ?? loc.cuerpo;
    const cuerpoId = cuerpoNum != null ? `cuerpo${cuerpoNum}` : undefined;

    // 1. Obtener la posición del mesh 3D real en la escena si está cargado
    let meshPos: BABYLON.Vector3 | null = null;
    if (meshPositionGetter) {
      meshPos = meshPositionGetter(destinationName, cuerpoId);
    }

    // 2. Obtener todos los navigation-paths del piso/edificio actual
    const paths = await this.firebaseService.getNavigationPathsByEdificioYPiso(edificio, piso);

    // 3. Buscar el destino en los navigation-paths
    const destMatch = paths.length > 0
      ? findDestinationInPaths(paths, destinationName)
      : null;
    const navPathCoord = destMatch ? destMatch.position : null;

    // 4. Coordenadas de la colección Locaciones como fallback
    const docCoord = this.extractVec3(loc);

    // Prioridad de destino:
    // 1) meshPos (posición real del mesh 3D en pantalla)
    // 2) navPathCoord (coordenada del conector en navigation-paths)
    // 3) docCoord (coordenada de la locación en Firestore)
    const destination = meshPos ?? navPathCoord ?? (docCoord ? new BABYLON.Vector3(docCoord.x, Math.max(docCoord.y, 0.05), docCoord.z) : null);

    if (!destination) {
      console.warn(`[MapNav] Sin coordenadas disponibles para: ${destinationName}`);
      return null;
    }

    // 5. Construir la ruta (Acceso → Giros → Destino)
    const routePoints = buildRoute(paths, null, destinationName, destination);
    const finalRoute = routePoints.length > 0 ? routePoints : [destination.clone()];

    const statusText = `${destinationName} — Edificio ${edificio} / ${piso} (Coord: ${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`;

    return {
      coord: destination,
      routePoints: finalRoute,
      statusText,
      piso,
      edificio
    };
  }
}

