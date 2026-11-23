import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as BABYLON from 'babylonjs';
import { EspaciosApiService } from '../../services/espacios-api.service';
import { NavegacionApiService } from '../../services/navegacion-api.service';
import { BuildingId, SelectedLocationInfo } from '../../core/models/navegacion.model';
import { BuildingRegistryService } from '../../core/services/building-registry.service';
import { Locacion } from '../../core/models/locacion.model';

@Injectable({
  providedIn: 'root'
})
export class MapNavigationService {
  private currentBuildingSubject = new BehaviorSubject<BuildingId>('S');
  public currentBuilding$ = this.currentBuildingSubject.asObservable();

  private currentFloorSubject = new BehaviorSubject<string>('Instituto3D-color.obj');
  public currentFloor$ = this.currentFloorSubject.asObservable();

  private selectedLocationSubject = new BehaviorSubject<SelectedLocationInfo | null>(null);
  public selectedLocation$ = this.selectedLocationSubject.asObservable();

  private destinationsSubject = new BehaviorSubject<string[]>([]);
  public destinations$ = this.destinationsSubject.asObservable();

  constructor(
    private espaciosApiService: EspaciosApiService,
    private navegacionApiService: NavegacionApiService,
    private buildingRegistry: BuildingRegistryService
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

  // Diagnóstico: solo se imprime cuando NO se encuentra información.
  // que empieza con [MAPA-DIAG] desde la consola del navegador (F12).
  private diag(motivo: string, datos: any): void {
    console.warn('[MAPA-DIAG] ' + motivo + ' ' + JSON.stringify(datos));
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

    const cleanMesh = (meshName || '').replace(/\s+/g, '').toLowerCase();
    const match = cleanMesh.match(/^cuerpo(\d+)/i);
    const grupoMatch = cleanMesh.match(/^[a-z]_p\d+_grupo_?(\d+)/i) || cleanMesh.match(/^grupo_?(\d+)/i);
    const roomMatch = cleanMesh.match(/^[a-z](\d{3})/i);
    const genericNumberMatch = cleanMesh.match(/(\d+)/);
    const cuerpoNum = match
      ? parseInt(match[1], 10)
      : (grupoMatch ? parseInt(grupoMatch[1], 10) : (roomMatch ? parseInt(roomMatch[1], 10) : null));

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
        this.diag('edificio_no_encontrado', {
          meshRecibido: meshName,
          modelo,
          edificioClave: claveActual,
          totalLocaciones: this.cachedLocations.length,
          edificiosEnBD: Array.from(new Set(this.cachedLocations.map((l: any) => String(nombreEdificioDe(l)))))
        });
        return null;
      }

      // 2° PISO
      const pisoActual = this.clavePiso(modelo);
      const delPiso = (esSede || pisoActual === null)
        ? delEdificio
        : delEdificio.filter((loc: any) => this.pisoDeLocacion(loc) === pisoActual);

      // 3° SALA
      const found: any = cuerpoNum !== null
        ? delPiso.find((loc: any) => this.claveCuerpo(this.getCI(loc, 'cuerpo')) === cuerpoNum)
        : delPiso.find((loc: any) => {
            const n = (this.getCI(loc, 'nombre') || '').toString().replace(/\s+/g, '').toLowerCase();
            const id = (loc.id || '').toString().replace(/\s+/g, '').toLowerCase();
            return n === cleanMesh || id === cleanMesh || n.includes(cleanMesh);
          }) || delEdificio.find((loc: any) => {
            const n = (this.getCI(loc, 'nombre') || '').toString().replace(/\s+/g, '').toLowerCase();
            const id = (loc.id || '').toString().replace(/\s+/g, '').toLowerCase();
            return n === cleanMesh || id === cleanMesh || n.includes(cleanMesh);
          });

      if (found) {
        const docCuerpo = this.getCI(found, 'cuerpo') ?? this.getCI(found, 'Cuerpo');
        const finalCuerpo = cuerpoNum !== null
          ? cuerpoNum
          : (docCuerpo != null && docCuerpo !== '' ? docCuerpo : undefined);
        const nombre = (this.getCI(found, 'nombre') ?? (finalCuerpo !== undefined ? `Cuerpo ${finalCuerpo}` : cleanMesh.toUpperCase())).toString();
        const tipo = (this.getCI(found, 'tipo') ?? 'Espacio académico').toString();
        const edificioTxt = (nombreEdificioDe(found) ?? currentBld).toString();
        const pisoTxt = `Piso ${this.pisoDeLocacion(found)}`;
        const isStair = /escalera|stair/i.test(tipo) || /escalera|stair/i.test(nombre);
        const cuerpoLabel = finalCuerpo !== undefined ? `Cuerpo ${finalCuerpo}, ` : '';
        return {
          nombre,
          desc: `${tipo} — ${cuerpoLabel}${edificioTxt}, ${pisoTxt}.`,
          edificio: currentBld,
          piso: pisoTxt,
          cuerpo: finalCuerpo,
          tipo,
          isStair
        };
      }

      this.diag('sala_no_encontrada', {
        meshRecibido: meshName,
        cuerpoBuscado: cuerpoNum,
        modelo,
        edificioClave: claveActual,
        pisoActual,
        locacionesDelEdificio: delEdificio.length,
        pisosDelEdificio: Array.from(new Set(delEdificio.map((l: any) => String(this.getCI(l, 'piso'))))),
        locacionesDelPiso: delPiso.length,
        cuerposDelPiso: delPiso.map((l: any) => this.getCI(l, 'cuerpo'))
      });
      return {
        nombre: 'Espacio no registrado',
        desc: `No hay una sala registrada para el Cuerpo ${cuerpoNum} en este edificio y piso.`,
        edificio: currentBld,
        piso: `Piso ${pisoActual ?? 1}`,
        cuerpo: cuerpoNum ?? undefined,
        tipo: 'Desconocido',
        isStair: false
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
          desc: `${tipo} — ${edificio ? 'Edificio ' + edificio : 'Sede Renca'}${piso ? ', ' + piso : ''}.`,
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

      const clean = (s: string) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const query = clean(destinationName);

      // 1. Coincidencia exacta
      let target = this.cachedLocations.find((loc: any) => {
        const name = clean(loc.Nombre || loc.nombre || '');
        return name === query;
      });
      if (target) return target;

      // 2. Coincidencia con o sin prefijo "sala ", "aula ", "oficina ", "laboratorio ", etc.
      const queryWithoutPrefix = query.replace(/^(sala|aula|lab|laboratorio|oficina|banos?|banio)\s+/i, '');
      target = this.cachedLocations.find((loc: any) => {
        const name = clean(loc.Nombre || loc.nombre || '');
        const nameWithoutPrefix = name.replace(/^(sala|aula|lab|laboratorio|oficina|banos?|banio)\s+/i, '');
        return nameWithoutPrefix === queryWithoutPrefix || name === queryWithoutPrefix || nameWithoutPrefix === query;
      });
      if (target) return target;

      // 3. Coincidencia por código de sala (ej. a101, b304, c101, c102, a204)
      const codeMatch = query.match(/[a-e]\d{3}/i);
      if (codeMatch) {
        const code = codeMatch[0];
        target = this.cachedLocations.find((loc: any) => {
          const name = clean(loc.Nombre || loc.nombre || '');
          return name.includes(code);
        });
        if (target) return target;
      }

      // 4. Búsqueda y resolución de Baños
      if (/ba[nñ]o/i.test(query)) {
        const isDamas = /dama|mujer|femenino/i.test(query);
        const isVarones = /varon|hombre|masculino/i.test(query);
        const pMatch = query.match(/piso\s*(\d)/i);
        const pisoNum = pMatch ? pMatch[1] : '1';
        const edMatch = query.match(/edificio\s*([a-e])|\b([a-e])\b/i);
        const edId: BuildingId = edMatch ? ((edMatch[1] || edMatch[2]).toUpperCase() as BuildingId) : 'A';

        // Buscar en las locaciones cacheadas
        target = this.cachedLocations.find((loc: any) => {
          const name = clean(loc.Nombre || loc.nombre || '');
          const locEd = (loc._edificioId || loc.Edificio || loc.edificio || '').toString().toUpperCase();
          const locPiso = (loc.Piso || loc.piso || '').toString();
          const matchEd = !edId || locEd.includes(edId);
          const matchPiso = locPiso.includes(pisoNum);
          const isBano = /ba[nñ]o/i.test(name) || /ba[nñ]o/i.test(loc.Tipo || loc.tipo || '');
          return isBano && matchEd && matchPiso;
        });
        if (target) return target;

        // Fallback dinámico si no está registrado en Firestore
        if (edId === 'A') {
          const cuerpoNum = isVarones ? 11 : 10;
          const yElev = pisoNum === '3' ? 0.86 : (pisoNum === '2' ? 0.41 : 0.05);
          return {
            id: `bano_A_P${pisoNum}_${isVarones ? 'V' : 'D'}`,
            Nombre: destinationName,
            Tipo: 'Baño',
            Edificio: 'Edificio A',
            _edificioId: 'A',
            _edificioNombre: 'Edificio A',
            Piso: `Piso ${pisoNum}`,
            Cuerpo: cuerpoNum,
            coordenadas: { x: isVarones ? 4.20 : 3.50, y: yElev, z: 0.16 }
          } as any;
        } else if (edId === 'C') {
          const mesh = isVarones ? 'C_P1_Grupo_11' : 'C_P1_Grupo_10';
          return {
            id: `bano_C_P1_${isVarones ? 'V' : 'D'}`,
            Nombre: destinationName,
            Tipo: 'Baño',
            Edificio: 'Edificio C',
            _edificioId: 'C',
            _edificioNombre: 'Edificio C',
            Piso: 'Piso 1',
            MeshName: mesh,
            Cuerpo: isVarones ? 11 : 10,
            coordenadas: { x: -2.20, y: 0.05, z: isVarones ? 15.50 : 13.80 }
          } as any;
        }
      }

      // 5. Fallback para salas conocidas (A101, A204, B304, C101, C102)
      if (codeMatch) {
        const code = codeMatch[0].toUpperCase();
        const ed = code.charAt(0) as BuildingId;
        const pisoDigit = code.charAt(1);
        const yElev = pisoDigit === '3' ? 0.86 : (pisoDigit === '2' ? 0.41 : 0.05);
        let coords = { x: 0, y: yElev, z: 0 };
        if (code === 'A101') coords = { x: -9.00, y: 0.05, z: 0.16 };
        else if (code === 'A204') coords = { x: 2.80, y: 0.41, z: 0.16 };
        else if (code === 'B304') coords = { x: -0.49, y: 0.86, z: -4.50 };
        else if (code === 'C101') coords = { x: -2.40, y: 0.05, z: 4.80 };
        else if (code === 'C102') coords = { x: -2.40, y: 0.05, z: 2.50 };

        return {
          id: `fallback_${code}`,
          Nombre: destinationName,
          Tipo: 'Sala',
          Edificio: `Edificio ${ed}`,
          _edificioId: ed,
          _edificioNombre: `Edificio ${ed}`,
          Piso: `Piso ${pisoDigit}`,
          MeshName: code,
          coordenadas: coords
        } as any;
      }

      return null;
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

  public getPisoFromModel(modelName: string): string {
    const lower = (modelName || '').toLowerCase();
    if (lower.includes('3')) return 'Piso 3';
    if (lower.includes('2')) return 'Piso 2';
    if (lower.includes('1')) return 'Piso 1';
    return 'Piso 1';
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
      const docCoord = this.extractVec3(loc);
      if (docCoord) {
        destCoord = new BABYLON.Vector3(docCoord.x, Math.max(docCoord.y, 0.05), docCoord.z);
      }
    }

    if (!destCoord) return null;

    const currentY = this.buildingRegistry.getFloorElevation(currentPiso, edificio);
    const targetY  = this.buildingRegistry.getFloorElevation(targetPiso, edificio);

    destCoord.y = targetY;

    // Dirección vertical de la animación
    const fromNum = parseInt(currentPiso.replace(/\D/g, ''), 10) || 1;
    const toNum   = parseInt(targetPiso.replace(/\D/g, ''), 10) || 1;
    const direction: 'up' | 'down' = toNum >= fromNum ? 'up' : 'down';

    // 2. Obtener escaleras desde la definición del edificio
    const stairsList = this.buildingRegistry.getDefaultStairs(edificio);
    if (!stairsList || stairsList.length === 0) {
      console.warn(`[MapNav Diagnostic] ⚠️ DATOS FALTANTES EN FIRESTORE:
  • Escalera no encontrada en 'navigation-paths/NavPathEdificio${edificio}-${currentPiso.replace(/\s+/g, '')}'.
  • Dónde agregarlo: En la colección 'navigation-paths', agregar 'Escalera': { x, y, z } en el mapa 'Accesos'.
  • Fallback: Se aplicaron coordenadas de circulación vertical estándar.`);
    }

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
    } else if (edificio === 'B') {
      const entranceB = new BABYLON.Vector3(-0.50, currentY, -0.78);
      const thresholdB = new BABYLON.Vector3(-0.50, currentY, -3.15);
      const landingB   = new BABYLON.Vector3(-0.49, currentY, -11.40);
      rawLeg1.push(entranceB, thresholdB, landingB);
    } else if (edificio === 'C') {
      const entranceC = new BABYLON.Vector3(4.60, currentY, 10.00);
      const approachC = new BABYLON.Vector3(1.30, currentY, 9.90);
      const landingC  = new BABYLON.Vector3(-2.20, currentY, 9.70);
      rawLeg1.push(entranceC, approachC, landingC);
    } else if (edificio === 'D') {
      const entranceD = new BABYLON.Vector3(-0.05, currentY, 11.10);
      const thresholdD = new BABYLON.Vector3(-0.05, currentY, 7.30);
      const landingD  = new BABYLON.Vector3(-1.00, currentY, 7.30);
      rawLeg1.push(entranceD, thresholdD, landingD);
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
    } else if (edificio === 'B') {
      // Edificio B: el pasillo principal corre a lo largo del eje Z en X = -0.50
      const pLanding   = new BABYLON.Vector3(-0.49, targetY, -11.40);
      const pThreshold = new BABYLON.Vector3(-0.50, targetY, -3.15);
      // Avanzar por el pasillo central en Z hasta la altura de la sala:
      const pCorridor  = new BABYLON.Vector3(-0.50, targetY, destCoord.z);
      // Girar 90° hacia la sala en X:
      const pDest      = new BABYLON.Vector3(destCoord.x, targetY, destCoord.z);

      rawLeg2.push(pLanding, pThreshold, pCorridor, pDest);
    } else if (edificio === 'C') {
      // Escalera Edificio C
      const pLanding   = new BABYLON.Vector3(-2.20, targetY, 9.70);
      const pThreshold = new BABYLON.Vector3(-2.40, targetY, 8.00);
      const pCorridor  = new BABYLON.Vector3(-2.40, targetY, destCoord.z);
      const pDest      = new BABYLON.Vector3(destCoord.x, targetY, destCoord.z);

      rawLeg2.push(pLanding, pThreshold, pCorridor, pDest);
    } else if (edificio === 'D') {
      // Escalera Edificio D
      const pLanding   = new BABYLON.Vector3(-1.00, targetY, 7.30);
      const pThreshold = new BABYLON.Vector3(-0.05, targetY, 7.30);
      const pCorridor  = new BABYLON.Vector3(-0.05, targetY, destCoord.z);
      const pDest      = new BABYLON.Vector3(destCoord.x, targetY, destCoord.z);

      rawLeg2.push(pLanding, pThreshold, pCorridor, pDest);
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

  /**
   * Determina desde los navigation-paths de la base de datos el conector de salida hacia el edificio destino
   */
  public async findConnectorToBuilding(
    sourceBuilding: BuildingId,
    targetBuilding: BuildingId,
    piso: string
  ): Promise<{ name: string; position: { x: number; y: number; z: number } }> {
    try {
      const paths = await this.navegacionApiService.getNavigationPathsByEdificioYPiso(sourceBuilding, piso);
      for (const p of paths) {
        const accesos = (p as any).Accesos || (p as any).accesos;
        if (!accesos) continue;
        const entries = Array.isArray(accesos)
          ? accesos.map((v, i) => [`Acceso${i+1}`, v])
          : Object.entries(accesos);

        for (const [key, val] of entries) {
          const kLower = key.toLowerCase();
          const targetKey = targetBuilding.toLowerCase();
          if (kLower.includes('conector') && (kLower.includes(targetKey) || kLower.includes(`edificio${targetKey}`))) {
            const pt = (val as any).Coordenadas3D || (val as any)['Coordenadas 3D'] || (val as any).Coordenadas || (val as any).coordenadas || val;
            if (pt && typeof pt === 'object') {
              const x = pt.x ?? pt.X ?? pt.CoordX;
              const y = pt.y ?? pt.Y ?? pt.CoordY ?? 0.05;
              const z = pt.z ?? pt.Z ?? pt.CoordZ;
              if (x != null && z != null) {
                return {
                  name: key,
                  position: { x: Number(x), y: Number(y), z: Number(z) }
                };
              }
            }
          }
        }
      }
    } catch {
      // Usar coordenadas de respaldo si la consulta falla
    }

    console.warn(`[MapNav Diagnostic] ⚠️ DATOS FALTANTES EN FIRESTORE:
  • Conector inter-edificio no encontrado: Edificio ${sourceBuilding} → Edificio ${targetBuilding} (${piso}).
  • Documento esperado: 'navigation-paths/NavPathEdificio${sourceBuilding}-${piso.replace(/\s+/g, '')}'
  • Dónde agregarlo: En la colección 'navigation-paths', dentro del mapa 'Accesos', agregar 'ConectorEdificio${targetBuilding}': { x, y, z }.
  • Fallback: Se aplicaron coordenadas de empalme geométricas predeterminadas.`);

    const getFloorY = (p: string) => this.buildingRegistry.getFloorElevation(p, sourceBuilding);
    const pNum = (piso || '').toString().replace(/\D/g, '') || '1';

    if (sourceBuilding === 'A' && targetBuilding === 'B') {
      const z = pNum === '3' ? -0.11 : pNum === '2' ? 0.51 : 0.64;
      const x = pNum === '3' ? 11.55 : pNum === '2' ? 11.60 : 11.65;
      return {
        name: 'ConectorEdificioB',
        position: { x, y: getFloorY(piso), z }
      };
    }
    if (sourceBuilding === 'B' && targetBuilding === 'A') {
      const x = pNum === '3' ? -0.10 : pNum === '2' ? -3.50 : -5.20;
      const z = pNum === '3' ? -8.70 : pNum === '2' ? -2.70 : -1.90;
      return {
        name: 'ConectorEdificioA',
        position: { x, y: getFloorY(piso), z }
      };
    }
    if (sourceBuilding === 'C' && targetBuilding === 'D') {
      return {
        name: 'ConectorEdificioD',
        position: { x: -2.40, y: getFloorY(piso), z: -2.20 }
      };
    }
    if (sourceBuilding === 'C' && targetBuilding === 'E') {
      return {
        name: 'ConectorEdificioE',
        position: { x: -3.160340012066989, y: 0.1469096839427877, z: 1.6463125327081438 }
      };
    }
    if (sourceBuilding === 'D' && targetBuilding === 'C') {
      return {
        name: 'ConectorEdificioC',
        position: { x: -0.05, y: getFloorY(piso), z: 11.10 }
      };
    }
    if (sourceBuilding === 'E' && targetBuilding === 'C') {
      return {
        name: 'ConectorEdificioC',
        position: { x: -10.257817831379821, y: 0.28873252858175036, z: 0.5507832656850731 }
      };
    }
    return {
      name: `ConectorEdificio${targetBuilding}`,
      position: { x: 0, y: getFloorY(piso), z: 0 }
    };
  }

  /**
   * Determina la dirección de la animación horizontal / lateral ('left' | 'right')
   * entre dos edificios basándose en las uniones de los pasillos registradas en la
   * base de datos (colección navigation-paths / Accesos) y la topología del campus.
   *
   * Ejemplos:
   *   - A -> B: salida este (+X en A) -> entra por la derecha ('right').
   *   - B -> A: regreso a A -> entra por la izquierda ('left').
   *   - C -> D: ala norte hacia D -> entra por la derecha ('right').
   *   - D -> C: regreso a C -> entra por la izquierda ('left').
   */
  public async getInterBuildingLateralDirection(
    sourceBuilding: BuildingId,
    targetBuilding: BuildingId,
    piso: string | number = 1
  ): Promise<'left' | 'right'> {
    const src = (sourceBuilding || '').toUpperCase() as BuildingId;
    const tgt = (targetBuilding || '').toUpperCase() as BuildingId;

    if (src === tgt) {
      return 'right';
    }

    const pisoStr = typeof piso === 'number' ? `Piso ${piso}` : (piso || 'Piso 1');

    try {
      // 1. Consultar conector en Firestore (colección navigation-paths)
      const connector = await this.findConnectorToBuilding(src, tgt, pisoStr);
      if (connector && connector.position) {
        const pos = connector.position;
        // En Edificio A: pasillo longitudinal en X, centro en X=0.
        // Conector con X > 0 implica salida hacia el extremo derecho (+X hacia B)
        if (src === 'A') {
          return pos.x >= 0 ? 'right' : 'left';
        }
        // En Edificio B: pasillo longitudinal en Z.
        // El acceso inicial conecta a A por el costado izquierdo
        if (src === 'B') {
          return 'left';
        }
        // En Edificio C: conector hacia D está en Z negativo (-2.20), avance a la derecha
        if (src === 'C' && tgt === 'D') {
          return 'right';
        }
        // En Edificio D: conector hacia C está en Z positivo (11.10), regreso hacia la izquierda
        if (src === 'D' && tgt === 'C') {
          return 'left';
        }
        if (src === 'D' && tgt === 'E') {
          return 'right';
        }
        if (src === 'E' && tgt === 'D') {
          return 'left';
        }
      }
    } catch {
      // Continuar con topología espacial si la consulta falla
    }

    // 2. Reglas topológicas conocidas de uniones de pasillos entre edificios
    if (src === 'A' && tgt === 'B') return 'right';
    if (src === 'B' && tgt === 'A') return 'left';
    if (src === 'C' && tgt === 'D') return 'right';
    if (src === 'D' && tgt === 'C') return 'left';
    if (src === 'D' && tgt === 'E') return 'right';
    if (src === 'E' && tgt === 'D') return 'left';

    // 3. Posicionamiento relativo en el campus (eje este-oeste)
    const bldSrc = this.buildingRegistry.getBuilding(src);
    const bldTgt = this.buildingRegistry.getBuilding(tgt);
    if (bldSrc && bldTgt) {
      return bldTgt.center.x >= bldSrc.center.x ? 'right' : 'left';
    }

    return (src === 'A' || src === 'C') ? 'right' : 'left';
  }

  /**
   * Calcula la ruta completa inter-edificios conectando mediante los pasillos y conectores de la BD:
   * 1. Tramo en edificio origen hasta el conector de salida.
   * 2. Transición lateral hacia el edificio destino (aparece desde el lado).
   * 3. En edificio destino:
   *    - Si el destino está en el mismo piso del conector, tramo directo a la sala.
   *    - Si el destino está en otro piso, tramo hasta la escalera del edificio destino,
   *      seguido de transición vertical (subir/bajar) y tramo final hasta la sala.
   */
  private async calculateInterBuildingRoute(
    loc: any,
    destinationName: string,
    sourceBuilding: BuildingId,
    targetBuilding: BuildingId,
    currentPiso: string,
    targetPiso: string
  ): Promise<{
    destCoord: BABYLON.Vector3;
    connectorName: string;
    lateralDirection: 'left' | 'right';
    intermediateBuilding: BuildingId;
    intermediateFloor: string;
    needsFloorChangeInTarget: boolean;
    stairNameInTarget?: string;
    verticalDirection?: 'up' | 'down';
    targetFloor?: string;
    leg1Points: BABYLON.Vector3[];
    leg2Points: BABYLON.Vector3[];
    leg3Points?: BABYLON.Vector3[];
  } | null> {
    const getFloorY = (p: string): number => {
      const lower = p.toLowerCase();
      if (lower.includes('3')) return 0.86;
      if (lower.includes('2')) return 0.41;
      return 0.05;
    };

    const currentY = getFloorY(currentPiso);
    const targetY  = getFloorY(targetPiso);

    // 1. Obtener conector de la base de datos
    const connector = await this.findConnectorToBuilding(sourceBuilding, targetBuilding, currentPiso);

    // 2. Coordenada final en el edificio destino
    let finalDestCoord: BABYLON.Vector3 | null = null;
    const backendTargetRoute = await this.navegacionApiService.getRutaEnriquecida(destinationName, {
      edificio: targetBuilding,
      piso: targetPiso
    }).catch(() => null);

    if (backendTargetRoute && Array.isArray(backendTargetRoute.coordinates) && backendTargetRoute.coordinates.length > 0) {
      const coords = backendTargetRoute.coordinates;
      const last = coords[coords.length - 1];
      finalDestCoord = new BABYLON.Vector3(last[0], last[1], last[2]);
    } else {
      const docCoord = this.extractVec3(loc);
      if (docCoord) {
        finalDestCoord = new BABYLON.Vector3(docCoord.x, Math.max(docCoord.y, 0.05), docCoord.z);
      }
    }

    if (!finalDestCoord) {
      const bldTgt = this.buildingRegistry.getBuilding(targetBuilding);
      const fixedCoord = bldTgt?.corridorFixedCoord ?? 0;
      finalDestCoord = bldTgt?.corridorAxis === 'x'
        ? new BABYLON.Vector3(0, targetY, fixedCoord)
        : new BABYLON.Vector3(fixedCoord, targetY, 0);
    }
    finalDestCoord.y = targetY;

    // 3. Tramo 1 (en edificio origen hacia el conector)
    const rawLeg1: BABYLON.Vector3[] = [];
    const connectorPt = new BABYLON.Vector3(connector.position.x, currentY, connector.position.z);
    const pNumSource = currentPiso.replace(/\D/g, '') || '1';

    if (sourceBuilding === 'A') {
      const westJunction = new BABYLON.Vector3(-9.21, currentY, -0.44);
      const eastJunction = new BABYLON.Vector3(9.80, currentY, 0.16);
      const approachZ = pNumSource === '3' ? 0.04 : 0.52;
      const approachX = pNumSource === '3' ? 10.92 : 10.25;
      const eastApproach = new BABYLON.Vector3(approachX, currentY, approachZ);
      rawLeg1.push(westJunction, eastJunction, eastApproach, connectorPt);
    } else if (sourceBuilding === 'B') {
      if (pNumSource === '3') {
        const farHallway   = new BABYLON.Vector3(-0.10, currentY, 8.70);
        const midHallway   = new BABYLON.Vector3(-0.40, currentY, -0.30);
        rawLeg1.push(farHallway, midHallway, connectorPt);
      } else {
        const stairLanding = new BABYLON.Vector3(-0.49, currentY, -11.40);
        const corridor     = new BABYLON.Vector3(-0.50, currentY, -3.15);
        rawLeg1.push(stairLanding, corridor, connectorPt);
      }
    } else if (sourceBuilding === 'C') {
      const entranceC    = new BABYLON.Vector3(4.60, currentY, 10.00);
      const corridorC    = new BABYLON.Vector3(-2.40, currentY, 9.70);
      rawLeg1.push(entranceC, corridorC, connectorPt);
    } else {
      const entranceD    = new BABYLON.Vector3(-0.05, currentY, -11.20);
      const corridorD    = new BABYLON.Vector3(-0.05, currentY, 0.40);
      rawLeg1.push(entranceD, corridorD, connectorPt);
    }
    const leg1Points = this.cleanRoutePoints(rawLeg1);

    // 4. Edificio intermedio y su piso al cruzar el conector
    const intermediateBuilding = targetBuilding;
    const intermediateFloor = currentPiso; // Se entra al piso equivalente al conector
    const intermediateY = getFloorY(intermediateFloor);

    // Dirección de la animación lateral según la unión de pasillos en la BD
    const lateralDirection = await this.getInterBuildingLateralDirection(sourceBuilding, targetBuilding, currentPiso);

    // 5. En el edificio destino: punto de acceso que conecta desde el edificio origen
    // Los puntos de acceso de la BD se tratan como ENTRADAS al nuevo mapa
    const targetEntranceConnector = await this.findConnectorToBuilding(targetBuilding, sourceBuilding, intermediateFloor);
    const targetEntryPoint = new BABYLON.Vector3(
      targetEntranceConnector.position.x,
      intermediateY,
      targetEntranceConnector.position.z
    );

    // ¿Requiere además cambio de piso (escaleras) en el edificio destino?
    const needsFloorChangeInTarget = intermediateFloor !== targetPiso;
    const pNumTarget = intermediateFloor.replace(/\D/g, '') || '1';

    if (needsFloorChangeInTarget) {
      // Tramo 2: Desde el punto de acceso de llegada hasta la escalera en el edificio destino
      const rawLeg2: BABYLON.Vector3[] = [];
      let stairNameInTarget = 'Escalera';

      if (targetBuilding === 'B') {
        stairNameInTarget = 'Escalera Edificio B';
        const entryB     = targetEntryPoint.clone();
        const stairLandB = new BABYLON.Vector3(-0.49, intermediateY, -11.40);
        if (pNumTarget === '3') {
          const corridorB = new BABYLON.Vector3(-0.40, intermediateY, entryB.z);
          rawLeg2.push(entryB, corridorB, stairLandB);
        } else {
          const corridorB = new BABYLON.Vector3(-0.50, intermediateY, -3.15);
          rawLeg2.push(entryB, corridorB, stairLandB);
        }
      } else if (targetBuilding === 'C') {
        stairNameInTarget = 'Escalera Edificio C';
        const entryC     = targetEntryPoint.clone();
        const corridorC  = new BABYLON.Vector3(-2.40, intermediateY, 8.00);
        const stairLandC = new BABYLON.Vector3(-2.20, intermediateY, 9.70);
        rawLeg2.push(entryC, corridorC, stairLandC);
      } else if (targetBuilding === 'D') {
        stairNameInTarget = 'Escalera Edificio D';
        const entryD     = targetEntryPoint.clone();
        const corridorD  = new BABYLON.Vector3(-0.05, intermediateY, 7.30);
        const stairLandD = new BABYLON.Vector3(-1.00, intermediateY, 7.30);
        rawLeg2.push(entryD, corridorD, stairLandD);
      } else {
        // Entrando a Edificio A
        stairNameInTarget = 'Escalera Principal';
        const entryA     = targetEntryPoint.clone();
        const approachX  = pNumTarget === '3' ? 10.92 : 10.25;
        const approachZ  = pNumTarget === '3' ? 0.04 : 0.52;
        const approachA  = new BABYLON.Vector3(approachX, intermediateY, approachZ);
        const junctionA  = new BABYLON.Vector3(9.80, intermediateY, 0.16);
        const stairLandA = new BABYLON.Vector3(9.80, intermediateY, -0.80);
        rawLeg2.push(entryA, approachA, junctionA, stairLandA);
      }
      const leg2Points = this.cleanRoutePoints(rawLeg2);

      // Dirección vertical dentro del edificio destino
      const fromNum = parseInt(intermediateFloor.replace(/\D/g, ''), 10) || 1;
      const toNum   = parseInt(targetPiso.replace(/\D/g, ''), 10) || 1;
      const verticalDirection: 'up' | 'down' = toNum >= fromNum ? 'up' : 'down';

      // Tramo 3: En el piso destino (targetPiso), desde la escalera a la sala
      const rawLeg3: BABYLON.Vector3[] = [];
      if (targetBuilding === 'B') {
        const pLanding   = new BABYLON.Vector3(-0.49, targetY, -11.40);
        const pThreshold = new BABYLON.Vector3(-0.50, targetY, -3.15);
        const pCorridor  = new BABYLON.Vector3(-0.50, targetY, finalDestCoord.z);
        const pDest      = new BABYLON.Vector3(finalDestCoord.x, targetY, finalDestCoord.z);
        rawLeg3.push(pLanding, pThreshold, pCorridor, pDest);
      } else if (targetBuilding === 'C') {
        const pLanding   = new BABYLON.Vector3(-2.20, targetY, 9.70);
        const pThreshold = new BABYLON.Vector3(-2.40, targetY, 8.00);
        const pCorridor  = new BABYLON.Vector3(-2.40, targetY, finalDestCoord.z);
        const pDest      = new BABYLON.Vector3(finalDestCoord.x, targetY, finalDestCoord.z);
        rawLeg3.push(pLanding, pThreshold, pCorridor, pDest);
      } else if (targetBuilding === 'D') {
        const pLanding   = new BABYLON.Vector3(-1.00, targetY, 7.30);
        const pThreshold = new BABYLON.Vector3(-0.05, targetY, 7.30);
        const pCorridor  = new BABYLON.Vector3(-0.05, targetY, finalDestCoord.z);
        const pDest      = new BABYLON.Vector3(finalDestCoord.x, targetY, finalDestCoord.z);
        rawLeg3.push(pLanding, pThreshold, pCorridor, pDest);
      } else {
        const pLanding   = new BABYLON.Vector3(9.80, targetY, -0.80);
        const pThreshold = new BABYLON.Vector3(9.80, targetY, 0.16);
        const pFacing    = new BABYLON.Vector3(finalDestCoord.x, targetY, 0.16);
        const pDest      = new BABYLON.Vector3(finalDestCoord.x, targetY, finalDestCoord.z);
        rawLeg3.push(pLanding, pThreshold, pFacing, pDest);
      }
      const leg3Points = this.cleanRoutePoints(rawLeg3);

      return {
        destCoord: finalDestCoord,
        connectorName: connector.name,
        lateralDirection,
        intermediateBuilding,
        intermediateFloor,
        needsFloorChangeInTarget: true,
        stairNameInTarget,
        verticalDirection,
        targetFloor: targetPiso,
        leg1Points,
        leg2Points,
        leg3Points
      };
    } else {
      // Mismo piso en edificio destino: del punto de acceso (entrada) directo a la sala final
      const rawLeg2: BABYLON.Vector3[] = [];

      if (targetBuilding === 'B') {
        const entryB = targetEntryPoint.clone();
        if (pNumTarget === '3') {
          // Edificio B Piso 3: entrada por acceso A en Z = -8.70
          const pCorridorEntry = new BABYLON.Vector3(-0.40, intermediateY, entryB.z);
          rawLeg2.push(entryB, pCorridorEntry);

          // Incluir hitos de pasillo intermedio si la sala está más adelante
          if (finalDestCoord.z > -0.30) {
            rawLeg2.push(new BABYLON.Vector3(-0.40, intermediateY, -0.30));
          }
          if (finalDestCoord.z > 5.00) {
            rawLeg2.push(new BABYLON.Vector3(-0.30, intermediateY, 5.00));
          }
          const pFacing = new BABYLON.Vector3(-0.40, intermediateY, finalDestCoord.z);
          const pDest   = new BABYLON.Vector3(finalDestCoord.x, intermediateY, finalDestCoord.z);
          rawLeg2.push(pFacing, pDest);
        } else if (pNumTarget === '2') {
          const pCorridor = new BABYLON.Vector3(-0.50, intermediateY, entryB.z);
          const pFacing   = new BABYLON.Vector3(-0.50, intermediateY, finalDestCoord.z);
          const pDest     = new BABYLON.Vector3(finalDestCoord.x, intermediateY, finalDestCoord.z);
          rawLeg2.push(entryB, pCorridor, pFacing, pDest);
        } else {
          const pCorridor = new BABYLON.Vector3(-2.50, intermediateY, entryB.z);
          const pFacing   = new BABYLON.Vector3(-0.50, intermediateY, finalDestCoord.z);
          const pDest     = new BABYLON.Vector3(finalDestCoord.x, intermediateY, finalDestCoord.z);
          rawLeg2.push(entryB, pCorridor, pFacing, pDest);
        }
      } else if (targetBuilding === 'A') {
        const entryA    = targetEntryPoint.clone();
        const approachX = pNumTarget === '3' ? 10.92 : 10.25;
        const approachZ = pNumTarget === '3' ? 0.04 : 0.52;
        const pApproach = new BABYLON.Vector3(approachX, intermediateY, approachZ);
        const pJunction = new BABYLON.Vector3(9.80, intermediateY, 0.16);
        const pFacing   = new BABYLON.Vector3(finalDestCoord.x, intermediateY, 0.16);
        const pDest     = new BABYLON.Vector3(finalDestCoord.x, intermediateY, finalDestCoord.z);
        rawLeg2.push(entryA, pApproach, pJunction, pFacing, pDest);
      } else if (targetBuilding === 'C') {
        const entryC    = targetEntryPoint.clone();
        const pCorridor = new BABYLON.Vector3(-2.40, intermediateY, finalDestCoord.z);
        const pDest     = new BABYLON.Vector3(finalDestCoord.x, intermediateY, finalDestCoord.z);
        rawLeg2.push(entryC, pCorridor, pDest);
      } else if (targetBuilding === 'D') {
        const entryD    = targetEntryPoint.clone();
        const pCorridor = new BABYLON.Vector3(-0.05, intermediateY, finalDestCoord.z);
        const pDest     = new BABYLON.Vector3(finalDestCoord.x, intermediateY, finalDestCoord.z);
        rawLeg2.push(entryD, pCorridor, pDest);
      } else {
        const entryGen = targetEntryPoint.clone();
        const pDest    = new BABYLON.Vector3(finalDestCoord.x, intermediateY, finalDestCoord.z);
        rawLeg2.push(entryGen, pDest);
      }
      const leg2Points = this.cleanRoutePoints(rawLeg2);

      return {
        destCoord: finalDestCoord,
        connectorName: connector.name,
        lateralDirection,
        intermediateBuilding,
        intermediateFloor,
        needsFloorChangeInTarget: false,
        leg1Points,
        leg2Points
      };
    }
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
    isMultiFloor?: boolean;
    leg1Points?: BABYLON.Vector3[];
    leg2Points?: BABYLON.Vector3[];
    chosenStairName?: string;
    direction?: 'up' | 'down';
    isInterBuilding?: boolean;
    lateralDirection?: 'left' | 'right' | 'lateral-right' | 'lateral-left';
    targetBuilding?: BuildingId;
    connectorName?: string;
    intermediateBuilding?: BuildingId;
    intermediateFloor?: string;
    needsFloorChangeInTarget?: boolean;
    stairNameInTarget?: string;
    verticalDirection?: 'up' | 'down';
    targetFloor?: string;
    leg3Points?: BABYLON.Vector3[];
    connectionName?: string | null;
  } | null> {
    const loc = await this.findLocationByName(destinationName);
    if (!loc) {
      return null;
    }

    const piso = this.getPisoFromLoc(loc);
    const edificioField = (loc as any)._edificioNombre || (loc as any).Edificio || (loc as any).edificio || 'A';
    const clave = this.claveEdificio(edificioField);
    const edificio: BuildingId = clave === 'b' ? 'B' : clave === 'c' ? 'C' : clave === 'd' ? 'D' : clave === 'e' ? 'E' : /s|sede/.test(clave) ? 'S' : 'A';
    const cuerpoNum = (loc as any).Cuerpo ?? (loc as any).cuerpo;
    const cuerpoId = cuerpoNum != null ? `cuerpo${cuerpoNum}` : undefined;

    const currentBuilding = this.currentBuildingSubject.value;
    const currentFloorModel = this.currentFloorSubject.value;
    const currentPiso = this.getPisoFromModel(currentFloorModel);
    const isSameBuilding = currentBuilding === edificio;

    // 0. Navegación genérica entre diferentes edificios (cualquier par de edificios)
    const isInterBuilding = !isSameBuilding && currentBuilding !== 'S' && edificio !== 'S';
    if (isInterBuilding) {
      const interRoute = await this.calculateInterBuildingRoute(
        loc,
        destinationName,
        currentBuilding,
        edificio,
        currentPiso,
        piso
      );
      if (interRoute) {
        return {
          coord: interRoute.destCoord,
          routePoints: interRoute.leg1Points,
          statusText: `${destinationName} — Edificio ${edificio} / ${piso} (vía ${interRoute.connectorName})`,
          piso,
          edificio,
          isMultiFloor: false,
          isInterBuilding: true,
          lateralDirection: interRoute.lateralDirection,
          targetBuilding: edificio,
          connectorName: interRoute.connectorName,
          intermediateBuilding: interRoute.intermediateBuilding,
          intermediateFloor: interRoute.intermediateFloor,
          needsFloorChangeInTarget: interRoute.needsFloorChangeInTarget,
          stairNameInTarget: interRoute.stairNameInTarget,
          verticalDirection: interRoute.verticalDirection,
          targetFloor: interRoute.targetFloor,
          leg1Points: interRoute.leg1Points,
          leg2Points: interRoute.leg2Points,
          leg3Points: interRoute.leg3Points
        };
      }
    }

    // Navegación genérica multi-piso dentro del mismo edificio (cualquier edificio)
    const isMultiFloor = isSameBuilding && currentPiso !== piso;

    if (isMultiFloor) {
      const multiFloorLegs = await this.calculateMultiFloorLegs(loc, destinationName, currentPiso, piso, edificio);
      if (multiFloorLegs) {
        const floorAction = multiFloorLegs.direction === 'up' ? 'Sube' : 'Baja';
        const destFloorNum = parseInt(piso.replace(/\D/g, ''), 10) || 1;
        const statusText = `${floorAction} hasta el ${destFloorNum}${destFloorNum === 1 ? 'er' : 'º'} piso — ${destinationName} — Edificio ${edificio} / ${piso} (vía ${multiFloorLegs.chosenStairName})`;
        return {
          coord: multiFloorLegs.destCoord,
          routePoints: multiFloorLegs.leg2Points,
          statusText,
          piso,
          edificio,
          isMultiFloor: true,
          direction: multiFloorLegs.direction,
          chosenStairName: multiFloorLegs.chosenStairName,
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
    const backendRoute: any = await this.navegacionApiService.getRutaEnriquecida(destinationName, {
      edificio,
      piso
    }).catch(() => null);

    let routePoints: BABYLON.Vector3[] = [];

    if (backendRoute && Array.isArray(backendRoute.coordinates) && backendRoute.coordinates.length > 0) {
      routePoints = backendRoute.coordinates.map((c: number[]) => new BABYLON.Vector3(c[0], c[1], c[2]));
    }

    // Fallback de coordenadas de la locación
    const docCoord = this.extractVec3(loc);
    const destination = (routePoints.length > 0 ? routePoints[routePoints.length - 1] : null)
      ?? (docCoord ? new BABYLON.Vector3(docCoord.x, Math.max(docCoord.y, 0.05), docCoord.z) : null)
      ?? meshPos;

    if (!destination) {
      console.warn(`[MapNav Diagnostic] ⚠️ DATOS FALTANTES EN FIRESTORE:
  • Destino: '${destinationName}'
  • Edificio: ${edificio} | Piso: ${piso}
  • Causa: No se encontraron coordenadas 3D para la sala en Firestore ni en la escena 3D activa.
  • Dónde agregarlo: En la colección 'Edificios/${(loc as any)?._edificioId || edificio}/Locaciones' (o la subcolección correspondiente del piso), asignar el campo 'Coordenadas 3D' con { x: number, y: number, z: number }.
  • Efecto: No se puede generar la ruta de navegación hasta que la sala cuente con coordenadas.`);
      return null;
    }

    // Para Edificios B, C y D, asegurar que el recorrido en el mismo piso siga el pasillo longitudinal (eje Z)
    if (edificio === 'B') {
      const targetY = destination.y;
      const startZ = currentFloor.includes('piso3') ? -8.70 : -1.90;
      routePoints = this.cleanRoutePoints([
        new BABYLON.Vector3(-0.40, targetY, startZ),
        new BABYLON.Vector3(-0.40, targetY, destination.z),
        destination.clone()
      ]);
    } else if (edificio === 'C') {
      const targetY = destination.y;
      const isSecondFloor = currentFloor.includes('piso2') || currentFloor.includes('2.obj') || piso === 'Piso 2';
      if (isSecondFloor) {
        routePoints = this.cleanRoutePoints([
          new BABYLON.Vector3(-2.20, targetY, 9.70),
          new BABYLON.Vector3(-2.40, targetY, 8.00),
          new BABYLON.Vector3(-2.40, targetY, destination.z),
          destination.clone()
        ]);
      } else {
        routePoints = this.cleanRoutePoints([
          new BABYLON.Vector3(4.60, targetY, 10.00),
          new BABYLON.Vector3(1.30, targetY, 9.90),
          new BABYLON.Vector3(-2.40, targetY, 9.70),
          new BABYLON.Vector3(-2.40, targetY, destination.z),
          destination.clone()
        ]);
      }
    } else if (edificio === 'D') {
      const targetY = destination.y;
      const isSecondFloor = currentFloor.includes('piso2') || currentFloor.includes('2.obj') || piso === 'Piso 2';
      if (isSecondFloor) {
        routePoints = this.cleanRoutePoints([
          new BABYLON.Vector3(-1.00, targetY, 7.30),
          new BABYLON.Vector3(-0.05, targetY, 7.30),
          new BABYLON.Vector3(-0.05, targetY, destination.z),
          destination.clone()
        ]);
      } else {
        routePoints = this.cleanRoutePoints([
          new BABYLON.Vector3(-0.05, targetY, 11.10),
          new BABYLON.Vector3(-0.05, targetY, destination.z),
          destination.clone()
        ]);
      }
    } else if (edificio === 'A') {
      const targetY = destination.y;
      const startX = 0.00;
      routePoints = this.cleanRoutePoints([
        new BABYLON.Vector3(startX, targetY, 0.16),
        new BABYLON.Vector3(destination.x, targetY, 0.16),
        destination.clone()
      ]);
    }

    const finalRoute = routePoints.length > 0 ? routePoints : [destination.clone()];

    const chosenStairName: string | undefined = backendRoute?.chosenStairName;
    const direction: 'up' | 'down' | undefined =
      backendRoute?.direction === 'down' ? 'down' : (backendRoute?.direction === 'up' ? 'up' : undefined);

    const leg1Points = Array.isArray(backendRoute?.leg1)
      ? backendRoute.leg1.map((c: number[]) => new BABYLON.Vector3(c[0], c[1], c[2]))
      : undefined;
    const leg2Points = Array.isArray(backendRoute?.leg2)
      ? backendRoute.leg2.map((c: number[]) => new BABYLON.Vector3(c[0], c[1], c[2]))
      : undefined;

    // Build statusText with floor change indication
    let floorMessage = '';
    const currentFloorMatch = this.currentFloorSubject.value.match(/Piso\s*(\-?\d+)/i);
    const currentFloorNum = currentFloorMatch ? parseInt(currentFloorMatch[1], 10) : 1;
    const destFloorMatch = piso.match(/Piso\s*(\-?\d+)/i);
    const destFloorNum = destFloorMatch ? parseInt(destFloorMatch[1], 10) : null;
    if (destFloorNum !== null && destFloorNum !== currentFloorNum) {
      const floorDir = destFloorNum > currentFloorNum ? 'Sube' : 'Baja';
      if (chosenStairName) {
        floorMessage = `${floorDir} hasta el ${destFloorNum}${destFloorNum === 1 ? 'er' : 'º'} piso`;
      } else {
        floorMessage = `${floorDir} al ${destFloorNum}${destFloorNum === 1 ? 'er' : 'º'} piso`;
      }
    }

    // Handle inter-building transitions
    const hasInterBuilding = !!backendRoute?.interBuilding;
    const connectionName: string | null = backendRoute?.connectionName || null;
    let interBuildingMessage = '';
    if (hasInterBuilding && connectionName) {
      interBuildingMessage = `Cruzando al edificio ${edificio} vía ${connectionName}`;
    }

    const statusText = (floorMessage || interBuildingMessage)
      ? `${floorMessage || interBuildingMessage} — ${destinationName} — Edificio ${edificio} / ${piso} (Coord: ${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`
      : `${destinationName} — Edificio ${edificio} / ${piso} (Coord: ${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`;

    return {
      coord: destination,
      routePoints: finalRoute,
      statusText,
      piso,
      edificio,
      isMultiFloor: !!chosenStairName,
      leg1Points,
      leg2Points,
      chosenStairName,
      direction,
      isInterBuilding: hasInterBuilding,
      connectionName,
    };
  }
}
