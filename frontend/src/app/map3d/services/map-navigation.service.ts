import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as BABYLON from 'babylonjs';
import { EspaciosApiService } from '../../services/espacios-api.service';
import { NavegacionApiService } from '../../services/navegacion-api.service';
import { BuildingId, SelectedLocationInfo } from '../../core/models/navegacion.model';
import { Locacion } from '../../core/models/locacion.model';

export interface NavigationRouteResult {
  coord: BABYLON.Vector3;
  routePoints: BABYLON.Vector3[];
  statusText: string;
  piso: string;
  edificio: BuildingId;
  isMultiFloor?: boolean;
  direction?: 'up' | 'down';
  chosenStairName?: string;
  stairWorldPos?: { x: number; z: number };
  leg1Points?: BABYLON.Vector3[];
  leg2Points?: BABYLON.Vector3[];
}

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
    'cuerpo20': { nombre: 'Sala A106', desc: 'Espacio académico del Edificio A, piso 1.' },
    'c101': { nombre: 'Sala C101', desc: 'Espacio académico (Convenio Legrand) del Edificio C, piso 1.' },
    'c102': { nombre: 'Sala C102', desc: 'Espacio académico (Electricidad y Electrónica) del Edificio C, piso 1.' },
    'c103': { nombre: 'Sala C103', desc: 'Espacio académico (Aplicaciones Computacionales) del Edificio C, piso 1.' },
    'c104': { nombre: 'Sala C104', desc: 'Espacio académico (Instrumentación y Control) del Edificio C, piso 1.' },
    'c105': { nombre: 'Sala C105', desc: 'Espacio académico (Aplicaciones Computacionales) del Edificio C, piso 1.' },
    'c106': { nombre: 'Sala C106', desc: 'Espacio académico (Electricidad y Electrónica) del Edificio C, piso 1.' },
    'c107': { nombre: 'Sala C107', desc: 'Espacio académico (Aplicaciones Computacionales) del Edificio C, piso 1.' }
  };

  // ──────────────────────────────────────────────────────────────
  // FIX: la resolución de "Edificio B, piso 3" (y B-cuerpo7-piso2) se
  // evalúa ANTES de depender del diccionario genérico `overrides`.
  // Antes, si el mesh clickeado (ej. cuerpo4, cuerpo5, cuerpo6, cuerpo8)
  // no existía en `overrides`, la función retornaba null de inmediato
  // y nunca llegaba a revisar `bThirdFloorOverrides`, que sí tenía el
  // nombre correcto de la sala. Por eso esos cuerpos mostraban el
  // fallback genérico "Cuerpo N" en vez del nombre de la sala.
  // ──────────────────────────────────────────────────────────────
  private getFloorSpecificInfo(meshName: string): SelectedLocationInfo | null {
    const normalizedMeshName = (meshName || '').replace(/\s+/g, '').toLowerCase();
    const floorText = this.currentFloorSubject.value.toLowerCase();
    const isSecondFloor = floorText.includes('piso2') || floorText.includes('2');
    const isThirdFloor = floorText.includes('piso3') || floorText.includes('3');

    // ── Edificio B, piso 3: se revisa primero, independiente del diccionario genérico ──
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

    // ── Diccionario genérico (Edificio A y demás casos no cubiertos arriba) ──
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

    if (isThirdFloor) {
      return override.thirdFloor ?? null;
    }
    return isSecondFloor ? override.secondFloor ?? null : override.firstFloor ?? null;
  }

  constructor(
    private espaciosApiService: EspaciosApiService,
    private navegacionApiService: NavegacionApiService
  ) {}

  public setBuilding(building: BuildingId): void {
    this.currentBuildingSubject.next(building);
  }

  public setFloor(floorModel: string): void {
    this.currentFloorSubject.next(floorModel);
  }

  public setSelectedLocation(location: SelectedLocationInfo | null): void {
    this.selectedLocationSubject.next(location);
  }

  private cachedLocations: Locacion[] = [];

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

    // Identificación de salas del Edificio C (Mesh18 C102_1 Model -> c102, etc.)
    if (this.currentBuildingSubject.value === 'C') {
      const cRoomMatch = normalizedMeshName.match(/c(10[1-7])/i);
      if (cRoomMatch) {
        const roomNum = cRoomMatch[1];
        const roomCode = `c${roomNum}`;
        if (this.infoDataMap[roomCode]) {
          return this.infoDataMap[roomCode];
        }
        return {
          nombre: `Sala C${roomNum}`,
          desc: `Espacio académico del Edificio C, Piso 1.`,
          edificio: 'C',
          piso: 'Piso 1'
        };
      }
    }

    const cleanName = meshName.replace(/\s+/g, '');
    const match = cleanName.match(/^cuerpo(\d+)/i);
    if (match) {
      const cuerpoNum = parseInt(match[1], 10);
      try {
        if (this.cachedLocations.length === 0) {
          this.cachedLocations = await this.espaciosApiService.getLocacionesDeTodosLosEdificios();
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
        this.cachedLocations = await this.espaciosApiService.getLocacionesDeTodosLosEdificios();
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

  public async loadDestinations(): Promise<string[]> {
    try {
      const locaciones = await this.espaciosApiService.getLocacionesDeTodosLosEdificios();
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

  public async findLocationByName(destinationName: string): Promise<Locacion | null> {
    try {
      if (this.cachedLocations.length === 0) {
        this.cachedLocations = await this.espaciosApiService.getLocacionesDeTodosLosEdificios();
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

  public extractVec3(obj: any, piso?: string, edificio?: string): BABYLON.Vector3 | null {
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

    let x = getField(src, 'x');
    let y = getField(src, 'y');
    let z = getField(src, 'z');

    if (x != null && !isNaN(x) && y != null && !isNaN(y) && z != null && !isNaN(z)) {
      const p = (piso || obj['Piso '] || obj.Piso || obj.piso || obj._coleccionPiso || '').toString().toLowerCase();
      const ed = (edificio || obj.Edificio || obj.edificio || obj._edificioNombre || obj._edificioId || '').toString().toLowerCase();
      const isEdA = !ed || ed.includes('a');
      const isPiso1 = p.includes('1');

      // Las locaciones de Edificio A Piso 1 en Firestore están en el sistema local del OBJ (x > 7 o y > 4 o z > 4).
      // Se normalizan con la fórmula canónica del backend: xMundo = (x - 22.74) * 0.51, zMundo = (y - 6.15) * 0.51
      if (isEdA && isPiso1 && (x > 7 || y > 4 || z > 4)) {
        const localZ = z > 4 ? z : y;
        const xMundo = Number(((x - 22.74) * 0.51).toFixed(2));
        const zMundo = Number(((localZ - 6.15) * 0.51).toFixed(2));
        return new BABYLON.Vector3(xMundo, 0.05, zMundo);
      }

      return new BABYLON.Vector3(x, y, z);
    }
    return null;
  }

  private getPisoFromLoc(loc: any): string {
    if (!loc) return 'Piso 1';
    const raw = loc.Piso ?? loc['Piso '] ?? loc.piso ?? loc['piso '] ?? loc.floor ?? loc.Floor ?? loc._coleccionPiso ?? loc._coleccion;
    if (!raw) return 'Piso 1';
    const str = raw.toString().trim();
    if (/3/i.test(str)) return 'Piso 3';
    if (/2/i.test(str)) return 'Piso 2';
    if (/-1|sub/i.test(str)) return 'Piso -1';
    if (/1/i.test(str)) return 'Piso 1';
    if (/^\d+$/.test(str)) return `Piso ${str}`;
    if (/^piso\s*\d+/i.test(str)) {
      const num = str.replace(/[^0-9-]/g, '');
      return `Piso ${num}`;
    }
    return str;
  }

  private getBuildingFromLoc(loc: any): BuildingId {
    if (!loc) return 'A';
    const field = (loc._edificioNombre || loc.Edificio || loc.edificio || loc._edificioId || '').toString().trim();
    if (/\bC\b|EDIFICIO\s*C/i.test(field)) return 'C';
    if (/\bB\b|EDIFICIO\s*B/i.test(field)) return 'B';
    if (/\bS\b|SEDE/i.test(field)) return 'S';
    if (/\bA\b|EDIFICIO\s*A/i.test(field)) return 'A';
    const name = (loc.Nombre || loc.nombre || '').trim();
    if (/^Sala\s*C/i.test(name) || /^C\d{3}/i.test(name)) return 'C';
    if (/^Sala\s*B/i.test(name) || /^B\d{3}/i.test(name)) return 'B';
    if (/^Sala\s*A/i.test(name) || /^A\d{3}/i.test(name)) return 'A';
    return 'A';
  }

  public getPisoFromModel(modelName: string): string {
    const lower = (modelName || '').toLowerCase();
    if (lower.includes('3')) return 'Piso 3';
    if (lower.includes('2')) return 'Piso 2';
    if (lower.includes('1')) return 'Piso 1';
    return 'Piso 1';
  }

  public async calculateRoute(
    destinationName: string,
    meshPositionGetter?: (locName: string, cuerpoId?: string) => BABYLON.Vector3 | null
  ): Promise<NavigationRouteResult | null> {
    const loc = await this.findLocationByName(destinationName);
    if (!loc) {
      return null;
    }

    const piso = this.getPisoFromLoc(loc);
    const edificio: BuildingId = this.getBuildingFromLoc(loc);
    const cuerpoNum = loc.Cuerpo ?? loc.cuerpo;
    const cuerpoId = cuerpoNum != null ? `cuerpo${cuerpoNum}` : undefined;

    // Verificar si es una navegación multi-piso dentro del mismo edificio (Edificio A o B)
    const currentBuilding = this.currentBuildingSubject.value;
    const currentFloorModel = this.currentFloorSubject.value;
    const currentPiso = this.getPisoFromModel(currentFloorModel);
    const isSameBuilding = currentBuilding === edificio;
    const isMultiFloor = isSameBuilding && currentPiso !== piso && (edificio === 'A' || edificio === 'B');

    if (isMultiFloor) {
      const multiFloorLegs = await this.calculateMultiFloorLegs(loc, destinationName, currentPiso, piso, edificio);
      if (multiFloorLegs) {
        const statusText = `${destinationName} — Edificio ${edificio} / ${piso} (vía ${multiFloorLegs.chosenStairName})`;
        return {
          coord: multiFloorLegs.destCoord,
          routePoints: multiFloorLegs.leg2Points,
          statusText,
          piso,
          edificio,
          isMultiFloor: true,
          direction: multiFloorLegs.direction,
          chosenStairName: multiFloorLegs.chosenStairName,
          stairWorldPos: multiFloorLegs.stairWorldPos,
          leg1Points: multiFloorLegs.leg1Points,
          leg2Points: multiFloorLegs.leg2Points
        };
      }
    }

    // 1. Obtener posición del mesh SOLO si el piso de la escena coincide con el de la locación
    const currentFloor = this.currentFloorSubject.value.toLowerCase();
    const isSameFloor = (piso === 'Piso 1' && (currentFloor.includes('piso1') || currentFloor.includes('1.obj')))
      || (piso === 'Piso 2' && (currentFloor.includes('piso2') || currentFloor.includes('2.obj')))
      || (piso === 'Piso 3' && (currentFloor.includes('piso3') || currentFloor.includes('3.obj')));

    let meshPos: BABYLON.Vector3 | null = null;
    if (meshPositionGetter && isSameFloor) {
      meshPos = meshPositionGetter(destinationName, cuerpoId);
    }

    // 2. Consumir la ruta directamente desde el backend Hexagonal
    const backendRoute = await this.navegacionApiService.getRutaEnriquecida(destinationName, {
      edificio,
      piso
    }).catch(() => null);

    let routePoints: BABYLON.Vector3[] = [];

    if (backendRoute && Array.isArray(backendRoute.coordinates) && backendRoute.coordinates.length > 0) {
      routePoints = backendRoute.coordinates.map((c) => new BABYLON.Vector3(c[0], c[1], c[2]));
    }

    // Fallback de coordenadas de la locación
    const docCoord = this.extractVec3(loc, piso, edificio);
    const destination = (routePoints.length > 0 ? routePoints[routePoints.length - 1] : null)
      ?? (docCoord ? new BABYLON.Vector3(docCoord.x, Math.max(docCoord.y, 0.05), docCoord.z) : null)
      ?? meshPos;

    if (!destination) {
      console.warn(`[MapNav] Sin coordenadas disponibles para: ${destinationName}`);
      return null;
    }

    const finalRoute = routePoints.length > 0 ? routePoints : [destination.clone()];
    const statusText = `${destinationName} — Edificio ${edificio} / ${piso} (Coord: ${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`;

    return {
      coord: destination,
      routePoints: finalRoute,
      statusText,
      piso,
      edificio,
      isMultiFloor: false
    };
  }

  private cleanRoutePoints(points: BABYLON.Vector3[]): BABYLON.Vector3[] {
    const result: BABYLON.Vector3[] = [];
    for (const pt of points) {
      if (result.length === 0) {
        result.push(pt.clone());
      } else {
        const prev = result[result.length - 1];
        if (BABYLON.Vector3.Distance(prev, pt) >= 0.15) {
          result.push(pt.clone());
        }
      }
    }
    if (points.length > 0 && result.length > 0) {
      const lastOrig = points[points.length - 1];
      const lastRes = result[result.length - 1];
      if (BABYLON.Vector3.Distance(lastRes, lastOrig) > 0.05) {
        result.push(lastOrig.clone());
      } else {
        result[result.length - 1] = lastOrig.clone();
      }
    }
    return result;
  }

  /**
   * Calcula los dos tramos de una ruta entre pisos diferentes de forma continua:
   * Tramo 1: Piso origen -> Pasillo -> Descanso interior de la escalera seleccionada.
   * Tramo 2: Descanso interior en piso destino -> Umbral del pasillo -> Doble en el piso
   *          de frente con el pasillo -> Pasillo principal -> Sala final.
   */
  private async calculateMultiFloorLegs(
    loc: any,
    destinationName: string,
    currentPiso: string,
    targetPiso: string,
    edificio: BuildingId
  ): Promise<{
    chosenStairName: string;
    stairWorldPos: { x: number; z: number };
    leg1Points: BABYLON.Vector3[];
    leg2Points: BABYLON.Vector3[];
    direction: 'up' | 'down';
    destCoord: BABYLON.Vector3;
  } | null> {
    // 1. Obtener la coordenada de destino en coordenadas mundo
    let destCoord: BABYLON.Vector3 | null = null;
    const backendTargetRoute = await this.navegacionApiService.getRutaEnriquecida(destinationName, {
      edificio,
      piso: targetPiso
    }).catch(() => null);

    if (backendTargetRoute && Array.isArray(backendTargetRoute.coordinates) && backendTargetRoute.coordinates.length > 0) {
      const coords = backendTargetRoute.coordinates;
      const last = coords[coords.length - 1];
      destCoord = new BABYLON.Vector3(last[0], last[1], last[2]);
    } else {
      destCoord = this.extractVec3(loc, targetPiso, edificio);
    }

    if (!destCoord) return null;

    // Alturas canónicas por piso
    const getFloorY = (p: string): number => {
      const lower = p.toLowerCase();
      if (lower.includes('3')) return 0.86;
      if (lower.includes('2')) return 0.41;
      return 0.05;
    };

    const currentY = getFloorY(currentPiso);
    const targetY  = getFloorY(targetPiso);

    destCoord.y = targetY;

    // Dirección vertical de la animación
    const fromNum = parseInt(currentPiso.replace(/\D/g, ''), 10) || 1;
    const toNum   = parseInt(targetPiso.replace(/\D/g, ''), 10) || 1;
    const direction: 'up' | 'down' = toNum >= fromNum ? 'up' : 'down';

    // 2. Definición geométrica de núcleos de circulación vertical y descansos de escalera
    const EDIFICIO_A_STAIRS = [
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
    ];

    const EDIFICIO_B_STAIRS = [
      {
        nombre: 'Escalera Edificio B',
        worldPos: { x: -0.49, z: -11.40 },
        landing:   { x: -0.49, z: -11.40 },
        threshold: { x: -0.50, z: -3.15 }
      }
    ];

    const stairsList = edificio === 'B' ? EDIFICIO_B_STAIRS : EDIFICIO_A_STAIRS;

    // Seleccionar la escalera más cercana al destino en planta (X, Z)
    let chosenStair = stairsList[0];
    let minDist = Infinity;
    for (const stair of stairsList) {
      const dist = Math.hypot(destCoord.x - stair.worldPos.x, destCoord.z - stair.worldPos.z);
      if (dist < minDist) {
        minDist = dist;
        chosenStair = stair;
      }
    }

    // ── Tramo 1: En piso actual hacia el interior de la escalera seleccionada ──
    const rawLeg1: BABYLON.Vector3[] = [];

    if (edificio === 'A') {
      const isSecundaria = chosenStair.nombre.includes('Secundaria');
      const entrance = new BABYLON.Vector3(11.60, currentY, 0.50);
      const eastApproach = new BABYLON.Vector3(10.25, currentY, 0.52);
      const eastJunction = new BABYLON.Vector3(9.80, currentY, 0.16);

      if (isSecundaria) {
        const westJunction = new BABYLON.Vector3(-9.21, currentY, -0.44);
        const westLanding  = new BABYLON.Vector3(-9.21, currentY, 0.80);
        rawLeg1.push(entrance, eastApproach, eastJunction, westJunction, westLanding);
      } else {
        const eastLanding = new BABYLON.Vector3(9.80, currentY, -0.80);
        rawLeg1.push(entrance, eastApproach, eastJunction, eastLanding);
      }
    } else {
      const entranceB = new BABYLON.Vector3(-0.50, currentY, -0.78);
      const thresholdB = new BABYLON.Vector3(-0.50, currentY, -3.15);
      const landingB   = new BABYLON.Vector3(-0.49, currentY, -11.40);
      rawLeg1.push(entranceB, thresholdB, landingB);
    }

    const leg1Points = this.cleanRoutePoints(rawLeg1);

    // ── Tramo 2: En piso destino, sale de la escalera, dobla en el piso y va a la sala ──
    const rawLeg2: BABYLON.Vector3[] = [];

    if (edificio === 'A') {
      const isSecundaria = chosenStair.nombre.includes('Secundaria');

      if (!isSecundaria) {
        // Escalera Principal (Este):
        // P0: descanso interior de la escalera (mismas coords X/Z que el final del tramo 1)
        const pLanding = new BABYLON.Vector3(9.80, targetY, -0.80);
        // P1: umbral de salida al pasillo central
        const pThreshold = new BABYLON.Vector3(9.80, targetY, 0.16);
        // P2: dobla en el piso y se encuentra de frente con el pasillo
        const facingX = destCoord.x < 9.80 ? Math.max(destCoord.x, 8.80) : Math.min(destCoord.x, 10.80);
        const pFacing = new BABYLON.Vector3(facingX, targetY, 0.16);
        // P3: punto sobre el pasillo alineado con la sala
        const pCorridor = new BABYLON.Vector3(destCoord.x, targetY, 0.16);
        // P4: dentro de la sala destino
        const pDest = new BABYLON.Vector3(destCoord.x, targetY, destCoord.z);

        rawLeg2.push(pLanding, pThreshold, pFacing, pCorridor, pDest);
      } else {
        // Escalera Secundaria (Oeste):
        // P0: descanso interior de la escalera
        const pLanding = new BABYLON.Vector3(-9.21, targetY, 0.80);
        // P1: umbral de salida al pasillo central
        const pThreshold = new BABYLON.Vector3(-9.21, targetY, -0.44);
        // P2: dobla en el piso y se encuentra de frente con el pasillo (hacia el este)
        const facingX = destCoord.x > -9.21 ? Math.min(destCoord.x, -8.21) : Math.max(destCoord.x, -10.21);
        const pFacing = new BABYLON.Vector3(facingX, targetY, -0.44);
        // P3: punto sobre el pasillo alineado con la sala
        const pCorridor = new BABYLON.Vector3(destCoord.x, targetY, -0.44);
        // P4: dentro de la sala destino
        const pDest = new BABYLON.Vector3(destCoord.x, targetY, destCoord.z);

        rawLeg2.push(pLanding, pThreshold, pFacing, pCorridor, pDest);
      }
    } else {
      // Edificio B:
      const pLanding = new BABYLON.Vector3(-0.49, targetY, -11.40);
      const pThreshold = new BABYLON.Vector3(-0.50, targetY, -3.15);
      const pJunction = new BABYLON.Vector3(-0.50, targetY, -0.78);
      const facingX = destCoord.x < -0.50 ? Math.max(destCoord.x, -2.0) : Math.min(destCoord.x, 1.0);
      const pFacing = new BABYLON.Vector3(facingX, targetY, -0.78);
      const pCorridor = new BABYLON.Vector3(destCoord.x, targetY, -0.78);
      const pDest = new BABYLON.Vector3(destCoord.x, targetY, destCoord.z);

      rawLeg2.push(pLanding, pThreshold, pJunction, pFacing, pCorridor, pDest);
    }

    const leg2Points = this.cleanRoutePoints(rawLeg2);

    return {
      chosenStairName: chosenStair.nombre,
      stairWorldPos: chosenStair.worldPos,
      leg1Points,
      leg2Points,
      direction,
      destCoord
    };
  }
}