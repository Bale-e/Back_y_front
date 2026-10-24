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

    const match = (meshName || '').replace(/\s+/g, '').match(/^cuerpo(\d+)/i);
    if (!match) {
      this.diag('mesh_sin_numero_de_cuerpo', { meshRecibido: meshName });
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

  /**
   * Determina desde los navigation-paths de la base de datos el conector de salida hacia el edificio destino
   */
  private async findConnectorToBuilding(
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
            if (pt && typeof pt === 'object' && pt.x != null && pt.z != null) {
              return {
                name: key,
                position: { x: Number(pt.x), y: Number(pt.y ?? 0.05), z: Number(pt.z) }
              };
            }
          }
        }
      }
    } catch {
      // Usar coordenadas de respaldo si la consulta falla
    }

    const getFloorY = (p: string) => p.includes('3') ? 0.86 : (p.includes('2') ? 0.41 : 0.05);
    if (sourceBuilding === 'A' && targetBuilding === 'B') {
      return {
        name: 'ConectorEdificioB',
        position: { x: 11.65, y: getFloorY(piso), z: 0.64 }
      };
    }
    return {
      name: 'ConectorEdificioA',
      position: { x: -0.50, y: getFloorY(piso), z: -0.78 }
    };
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

    if (!finalDestCoord) return null;
    finalDestCoord.y = targetY;

    // 3. Tramo 1 (en edificio origen hacia el conector)
    const rawLeg1: BABYLON.Vector3[] = [];
    if (sourceBuilding === 'A') {
      const westJunction = new BABYLON.Vector3(-9.21, currentY, -0.44);
      const eastJunction = new BABYLON.Vector3(9.80, currentY, 0.16);
      const eastApproach = new BABYLON.Vector3(10.25, currentY, 0.52);
      const connectorPt  = new BABYLON.Vector3(connector.position.x, currentY, connector.position.z);
      rawLeg1.push(westJunction, eastJunction, eastApproach, connectorPt);
    } else {
      const stairLanding = new BABYLON.Vector3(-0.49, currentY, -11.40);
      const corridor     = new BABYLON.Vector3(-0.50, currentY, -3.15);
      const connectorPt  = new BABYLON.Vector3(-0.50, currentY, -0.78);
      rawLeg1.push(stairLanding, corridor, connectorPt);
    }
    const leg1Points = this.cleanRoutePoints(rawLeg1);

    // 4. Edificio intermedio y su piso al cruzar el conector
    const intermediateBuilding = targetBuilding;
    const intermediateFloor = currentPiso; // Se entra al piso equivalente al conector
    const intermediateY = getFloorY(intermediateFloor);

    // Dirección de la animación lateral: A hacia B entra desde la derecha ('right'); B hacia A entra desde la izquierda ('left')
    const lateralDirection: 'left' | 'right' = (sourceBuilding === 'A' && targetBuilding === 'B') ? 'right' : 'left';

    // 5. En el edificio destino: ¿Requiere además cambio de piso (escaleras)?
    const needsFloorChangeInTarget = intermediateFloor !== targetPiso;

    if (needsFloorChangeInTarget) {
      // Tramo 2: Desde el conector de llegada hasta la escalera en el edificio destino
      const rawLeg2: BABYLON.Vector3[] = [];
      let stairNameInTarget = 'Escalera';

      if (targetBuilding === 'B') {
        stairNameInTarget = 'Escalera Edificio B';
        const entryB     = new BABYLON.Vector3(-0.50, intermediateY, -0.78);
        const corridorB  = new BABYLON.Vector3(-0.50, intermediateY, -3.15);
        const stairLandB = new BABYLON.Vector3(-0.49, intermediateY, -11.40);
        rawLeg2.push(entryB, corridorB, stairLandB);
      } else {
        // Entrando a Edificio A
        stairNameInTarget = 'Escalera Principal';
        const entryA     = new BABYLON.Vector3(11.60, intermediateY, 0.50);
        const approachA  = new BABYLON.Vector3(10.25, intermediateY, 0.52);
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
        const pJunction  = new BABYLON.Vector3(-0.50, targetY, -0.78);
        const pFacing    = new BABYLON.Vector3(finalDestCoord.x, targetY, -0.78);
        const pDest      = new BABYLON.Vector3(finalDestCoord.x, targetY, finalDestCoord.z);
        rawLeg3.push(pLanding, pThreshold, pJunction, pFacing, pDest);
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
      // Mismo piso en edificio destino: del conector directo a la sala final
      const rawLeg2: BABYLON.Vector3[] = [];
      if (targetBuilding === 'B') {
        const entryB  = new BABYLON.Vector3(-0.50, intermediateY, -0.78);
        const pFacing = new BABYLON.Vector3(finalDestCoord.x, intermediateY, -0.78);
        const pDest   = new BABYLON.Vector3(finalDestCoord.x, intermediateY, finalDestCoord.z);
        rawLeg2.push(entryB, pFacing, pDest);
      } else {
        const entryA  = new BABYLON.Vector3(11.60, intermediateY, 0.50);
        const pFacing = new BABYLON.Vector3(finalDestCoord.x, intermediateY, 0.16);
        const pDest   = new BABYLON.Vector3(finalDestCoord.x, intermediateY, finalDestCoord.z);
        rawLeg2.push(entryA, pFacing, pDest);
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
    const edificio: BuildingId = clave === 'b' ? 'B' : clave === 'c' ? 'C' : /s|sede/.test(clave) ? 'S' : 'A';
    const cuerpoNum = (loc as any).Cuerpo ?? (loc as any).cuerpo;
    const cuerpoId = cuerpoNum != null ? `cuerpo${cuerpoNum}` : undefined;

    const currentBuilding = this.currentBuildingSubject.value;
    const currentFloorModel = this.currentFloorSubject.value;
    const currentPiso = this.getPisoFromModel(currentFloorModel);
    const isSameBuilding = currentBuilding === edificio;

    // 0. Verificar si es una navegación entre diferentes edificios (Edificio A <-> Edificio B)
    if (!isSameBuilding && (edificio === 'A' || edificio === 'B') && (currentBuilding === 'A' || currentBuilding === 'B')) {
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

    // Verificar si es una navegación multi-piso dentro del mismo edificio (Edificio A o B)
    const isMultiFloor = isSameBuilding && currentPiso !== piso && (edificio === 'A' || edificio === 'B');

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
      console.warn(`[MapNav] Sin coordenadas disponibles para: ${destinationName}`);
      return null;
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
    const isInterBuilding = !!backendRoute?.interBuilding;
    const connectionName: string | null = backendRoute?.connectionName || null;
    let interBuildingMessage = '';
    if (isInterBuilding && connectionName) {
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
      isInterBuilding,
      connectionName,
    };
  }
}
