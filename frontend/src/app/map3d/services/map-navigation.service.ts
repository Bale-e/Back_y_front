import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as BABYLON from 'babylonjs';
import { EspaciosApiService } from '../../services/espacios-api.service';
import { NavegacionApiService } from '../../services/navegacion-api.service';
import { BuildingId, SelectedLocationInfo } from '../../core/models/navegacion.model';
import { Locacion } from '../../core/models/locacion.model';

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

  // ──────────────────────────────────────────────────────────────
  // Extrae la letra de edificio ("A", "B", "S") desde el nombre de
  // edificio que ya viaja en la respuesta del backend (edificioNombre /
  // _edificioNombre, ej. "Edificio B"). Ya NO se compara contra el ID
  // de documento de Firestore (_edificioId), porque ese ID es un hash
  // aleatorio y compararlo con .includes('a') / .includes('b') daba
  // falsos positivos.
  // ──────────────────────────────────────────────────────────────
  private getLetraEdificio(loc: any): string {
    const nombreEdificio = (loc?.edificioNombre || loc?._edificioNombre || loc?.Edificio || loc?.edificio || '').toString();
    const match = nombreEdificio.match(/edificio\s*([a-z])/i);
    if (match) return match[1].toLowerCase();
    // fallback: si el propio nombre es una sola letra ("B") o similar
    const single = nombreEdificio.trim().toLowerCase();
    return single.length === 1 ? single : '';
  }

  // Normaliza un string de piso a algo comparable, ej. "Piso 3" -> "piso3"
  private normalizarPiso(piso: string): string {
    return (piso || '').toString().toLowerCase().replace(/\s+/g, '');
  }

  // ──────────────────────────────────────────────────────────────
  // Resuelve el nombre/descr. de una sala a partir del meshName
  // ("cuerpo4", "cuerpo20 (3)", etc.) consultando ÚNICAMENTE las
  // locaciones que trae el backend (Firestore), filtradas por el
  // edificio y piso actualmente visibles en la escena 3D.
  // No requiere mantener ninguna lista manual: agregar/editar una
  // sala en Firestore (con su Cuerpo, Piso, Nombre, Edificio) se
  // refleja automáticamente acá.
  // ──────────────────────────────────────────────────────────────
  public async getLocationInfoByMeshNameAsync(meshName: string): Promise<SelectedLocationInfo | null> {
    const normalizedMeshName = (meshName || '').replace(/\s+/g, '').toLowerCase();

    const isBackgroundMesh = (normalizedMeshName.includes('untitled') || normalizedMeshName.includes('fixed') || normalizedMeshName.includes('sede') || normalizedMeshName === 'ground' || normalizedMeshName === 'suelo')
      && !/^cuerpo\d+/i.test(normalizedMeshName);

    if (isBackgroundMesh) {
      return null;
    }

    const cleanName = meshName.replace(/\s+/g, '');
    const match = cleanName.match(/^cuerpo(\d+)/i);
    if (!match) {
      return null;
    }

    const cuerpoNum = parseInt(match[1], 10);

    try {
      if (this.cachedLocations.length === 0) {
        this.cachedLocations = await this.espaciosApiService.getLocacionesDeTodosLosEdificios();
      }

      const currentBld = this.currentBuildingSubject.value;
      const currentFloorNorm = this.normalizarPiso(this.currentFloorSubject.value);

      const found = this.cachedLocations.find((loc: any) => {
        const locCuerpo = loc.cuerpo ?? loc.Cuerpo;
        if (locCuerpo == null) return false;
        if (parseInt(locCuerpo, 10) !== cuerpoNum) return false;

        if (currentBld === 'S') return true;

        const letraEdificioLoc = this.getLetraEdificio(loc);
        const matchBuilding = letraEdificioLoc === currentBld.toLowerCase();

        const locFloorNorm = this.normalizarPiso(loc.piso ?? loc.Piso);
        const matchFloor = currentFloorNorm.includes(locFloorNorm) || locFloorNorm.includes(currentFloorNorm);

        return matchBuilding && matchFloor;
      });

      if (found) {
        const name = (found as any).nombre || (found as any).Nombre || `Cuerpo ${cuerpoNum}`;
        const tipo = (found as any).tipo || (found as any).Tipo || 'Espacio académico';
        const floorStr = (found as any).piso || (found as any).Piso || 'Piso 1';
        const edificioStr = (found as any).edificioNombre || (found as any)._edificioNombre || currentBld;
        return {
          nombre: name,
          desc: `${tipo} — ${edificioStr}, ${floorStr}.`,
          edificio: edificioStr,
          piso: floorStr
        };
      }
    } catch (err) {
      console.warn('Error al buscar info por meshName:', err);
    }

    // Fallback final: no se encontró coincidencia en el backend para
    // este cuerpo/edificio/piso. Puede significar que la sala aún no
    // tiene el campo "Cuerpo" cargado en Firestore, o que no coincide
    // con el edificio/piso actual.
    return {
      nombre: `Cuerpo ${match[1]}`,
      desc: `Espacio de la sede Inacap. Información e indicaciones disponibles para Cuerpo ${match[1]}.`,
      edificio: this.currentBuildingSubject.value,
      piso: this.currentFloorSubject.value
    };
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
    const docCoord = this.extractVec3(loc);
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
      edificio
    };
  }
}