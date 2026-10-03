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

  // ── Utilidades de comparación: insensibles a mayúsculas, tildes y espacios ──
  private norm(valor: any): string {
    return (valor ?? '')
      .toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Lee un campo sin importar cómo esté escrito su nombre ("Piso", "piso ", "PISO"...)
  private getCI(obj: any, ...nombres: string[]): any {
    if (!obj) return undefined;
    const claves = Object.keys(obj);
    for (const nombre of nombres) {
      const objetivo = this.norm(nombre);
      // Se revisan TODAS las claves equivalentes (p. ej. "edificioNombre" y "_edificioNombre")
      // y se devuelve la primera que tenga valor.
      for (const clave of claves) {
        if (this.norm(clave) !== objetivo) continue;
        const valor = obj[clave];
        if (valor !== undefined && valor !== null && valor !== '') {
          return valor;
        }
      }
    }
    return undefined;
  }

  // Clave distintiva de un edificio, sirve tanto para el nombre guardado en la
  // base de datos como para el nombre del modelo 3D cargado:
  //   "Edificio B - Piso 3.obj" -> "b"   |   "EDIFICIO b " -> "b"
  //   "Edifico A" -> "a"                 |   "Torre Central" -> "central"
  // No conoce nombres de edificios: cualquier edificio que exista en la BD sirve.
  private claveEdificio(texto: any): string {
    return this.norm(texto)
      .replace(/\.(obj|glb|gltf|fbx|stl|dae)$/, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\b(piso|nivel|planta)\b.*$/, '')
      .replace(/[\s\-–—:,.]+$/, '')
      .replace(/^(edificio|edifico|edif|building|bloque|torre)\s+/, '')
      .trim();
  }

  // "Piso 3", "piso3", "PISO -1", "Locaciones piso 2", "Edificio B - Piso 3.obj",
  // "tercer piso", 3  ->  número de piso (null si no se puede determinar)
  private clavePiso(texto: any): number | null {
    if (texto === null || texto === undefined || texto === '') return null;
    const t = this.norm(texto).replace(/\.(obj|glb|gltf|fbx|stl|dae)$/, '');

    const m = t.match(/\b(piso|nivel|planta)\b(.*)$/);
    const zona = m ? m[2] : t;
    const numero = zona.match(/(-?\d+)/);
    if (numero) return parseInt(numero[1], 10);

    const ordinales: Record<string, number> = {
      primer: 1, primero: 1, primera: 1, segundo: 2, segunda: 2,
      tercer: 3, tercero: 3, tercera: 3, cuarto: 4, cuarta: 4,
      quinto: 5, quinta: 5, sexto: 6, septimo: 7, octavo: 8, noveno: 9, decimo: 10
    };
    for (const palabra of t.split(/[^a-z]+/)) {
      if (ordinales[palabra] !== undefined) return ordinales[palabra];
    }
    if (/(subsuelo|subterraneo|sotano)/.test(t)) return -1;
    return null;
  }

  // Piso de una locación: primero el campo Piso; si no trae número (p. ej. la
  // colección base "Locaciones"), se asume Piso 1, igual que el resto de este servicio.
  private pisoDeLocacion(loc: any): number {
    return this.clavePiso(this.getCI(loc, 'piso', 'floor', 'nivel')) ?? 1;
  }

  // 8, "8", "Cuerpo 8", "cuerpo8" -> 8
  private claveCuerpo(valor: any): number | null {
    if (valor === null || valor === undefined || valor === '') return null;
    const m = this.norm(valor).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  // ──────────────────────────────────────────────────────────────
  // Búsqueda estructurada contra los datos de la base de datos:
  //   1° EDIFICIO -> 2° PISO -> 3° SALA (cuerpo)
  // El edificio y el piso se leen del modelo 3D cargado, el cuerpo del mesh
  // clickeado. No hay listas manuales de salas ni edificios escritos a mano.
  // ──────────────────────────────────────────────────────────────
  public async getLocationInfoByMeshNameAsync(meshName: string): Promise<SelectedLocationInfo | null> {
    const normalizedMeshName = (meshName || '').replace(/\s+/g, '').toLowerCase();
    const isBackgroundMesh = (normalizedMeshName.includes('untitled') || normalizedMeshName.includes('fixed') || normalizedMeshName.includes('sede') || normalizedMeshName === 'ground' || normalizedMeshName === 'suelo')
      && !/^cuerpo\d+/i.test(normalizedMeshName);

    if (isBackgroundMesh) {
      return null;
    }

    const match = (meshName || '').replace(/\s+/g, '').match(/^cuerpo(\d+)/i);
    if (!match) {
      return null;
    }
    const cuerpoNum = parseInt(match[1], 10);

    const currentBld = this.currentBuildingSubject.value;
    const modelo = this.currentFloorSubject.value; // ej. "Edificio B - Piso 3.obj"

    try {
      if (this.cachedLocations.length === 0) {
        this.cachedLocations = await this.espaciosApiService.getLocacionesDeTodosLosEdificios();
      }

      const esSede = currentBld === 'S';
      const nombreEdificioDe = (loc: any) => this.getCI(loc, '_edificioNombre', 'edificioNombre', 'edificio');

      // 1° EDIFICIO
      const claveActual = this.claveEdificio(modelo);
      const delEdificio = esSede
        ? this.cachedLocations
        : this.cachedLocations.filter((loc: any) => this.claveEdificio(nombreEdificioDe(loc)) === claveActual);

      if (!esSede && delEdificio.length === 0) {
        return {
          nombre: 'Edificio no registrado',
          desc: 'No se encontraron locaciones de este edificio en la base de datos.',
          edificio: currentBld,
          piso: modelo
        };
      }

      // 2° PISO
      const pisoActual = this.clavePiso(modelo);
      const delPiso = (esSede || pisoActual === null)
        ? delEdificio
        : delEdificio.filter((loc: any) => this.pisoDeLocacion(loc) === pisoActual);

      // 3° SALA
      const found: any = delPiso.find((loc: any) => this.claveCuerpo(this.getCI(loc, 'cuerpo')) === cuerpoNum);

      if (found) {
        const nombre = (this.getCI(found, 'nombre') ?? `Cuerpo ${cuerpoNum}`).toString();
        const tipo = (this.getCI(found, 'tipo') ?? 'Espacio académico').toString();
        const edificioTxt = (nombreEdificioDe(found) ?? currentBld).toString();
        const pisoTxt = `Piso ${this.pisoDeLocacion(found)}`;
        return {
          nombre,
          desc: `${tipo} — Cuerpo ${cuerpoNum}, ${edificioTxt}, ${pisoTxt}.`,
          edificio: currentBld,
          piso: pisoTxt
        };
      }

      return {
        nombre: 'Espacio no registrado',
        desc: `No hay una sala registrada para el Cuerpo ${cuerpoNum} en este edificio y piso.`,
        edificio: currentBld,
        piso: modelo
      };
    } catch (err) {
      console.warn('Error al buscar info por meshName:', err);
      return {
        nombre: 'Error al consultar información',
        desc: 'Ocurrió un problema al consultar la base de datos. Intenta nuevamente.',
        edificio: currentBld,
        piso: modelo
      };
    }
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