import { Injectable } from '@angular/core';
import { API_BASE_URL, AUTH_HEADERS, adminHeaders } from '../core/config/api.config';
import { Edificio } from '../core/models/edificio.model';
import { Locacion } from '../core/models/locacion.model';

@Injectable({
  providedIn: 'root'
})
export class EspaciosApiService {
  private cache = new Map<string, any>();

  // ── EDIFICIOS ───────────────────────────────────────────────
  /**
   * Guarda en caché la PROMESA (no solo el resultado): así, si dos partes de la
   * app piden lo mismo al mismo tiempo, se hace una sola petición. Antes cada
   * edificio se pedía dos veces al cargar el mapa. Si la petición falla, se
   * borra de la caché para poder reintentar.
   */
  private cached<T>(cacheKey: string, cargar: () => Promise<T>): Promise<T> {
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    const promesa = cargar().catch((err) => {
      this.cache.delete(cacheKey);
      throw err;
    });
    this.cache.set(cacheKey, promesa);
    return promesa;
  }

  async getEdificios(): Promise<Edificio[]> {
    return this.cached('edificios', async () => {
      const res = await fetch(`${API_BASE_URL}/edificios`, { headers: AUTH_HEADERS });
      if (!res.ok) throw new Error('Error al obtener edificios desde la API');
      return (await res.json()) as Edificio[];
    });
  }

  async getEdificioPorId(id: string): Promise<Edificio | null> {
    const res = await fetch(`${API_BASE_URL}/edificios/${encodeURIComponent(id)}`, { headers: AUTH_HEADERS });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Error al obtener edificio por ID');
    }
    return res.json();
  }

  async getEdificioPorNombre(nombre: string): Promise<Edificio | null> {
    const res = await fetch(`${API_BASE_URL}/edificios/nombre/${encodeURIComponent(nombre)}`, { headers: AUTH_HEADERS });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Error al buscar edificio por nombre');
    }
    return res.json();
  }

  // ── LOCACIONES POR EDIFICIO ─────────────────────────────────
  async getLocacionesDeEdificio(edificioId: string): Promise<Locacion[]> {
    return this.cached(`locaciones:${edificioId}`, async () => {
      const res = await fetch(`${API_BASE_URL}/edificios/${encodeURIComponent(edificioId)}/locaciones`, { headers: AUTH_HEADERS });
      if (!res.ok) throw new Error('Error al obtener locaciones');
      return (await res.json()) as Locacion[];
    }).catch(() => []);
  }

  async getLocacionesDeTodosLosEdificios(): Promise<Locacion[]> {
    return this.cached('locaciones:todas', () => this.cargarLocacionesDeTodos());
  }

  private async cargarLocacionesDeTodos(): Promise<Locacion[]> {
    const edificios = await this.getEdificios();
    const results: Locacion[] = [];

    await Promise.all(
      edificios.map(async (ed) => {
        const locs = await this.getLocacionesDeEdificio(ed.id);
        const edNombre = ed.Nombre || ed.nombre || `Edificio ${ed.id}`;
        const match = edNombre.match(/edifici?o\s*([a-zA-Z0-9]+)/i);
        const edCodigo = match ? match[1].toUpperCase() : (ed.id && ed.id.length <= 2 ? ed.id.toUpperCase() : '');
        locs.forEach((loc) => {
          results.push({
            ...loc,
            _edificioId: ed.id,
            _edificioNombre: edNombre,
            _edificioCodigo: edCodigo,
            edificio: loc.edificio || loc.Edificio || edCodigo || undefined
          });
        });
      })
    );

    return results;
  }

  // ── BÚSQUEDAS GLOBALES ──────────────────────────────────────
  async getLocacionPorNombre(nombre: string): Promise<Locacion | null> {
    const res = await fetch(`${API_BASE_URL}/locaciones/${encodeURIComponent(nombre)}`, { headers: AUTH_HEADERS });
    if (!res.ok) return null;
    return res.json();
  }

  async getLocacionesPorPiso(piso: string): Promise<Locacion[]> {
    const res = await fetch(`${API_BASE_URL}/locaciones/piso/${encodeURIComponent(piso)}`, { headers: AUTH_HEADERS });
    if (!res.ok) return [];
    return res.json();
  }

  async getLocacionesPorTipo(tipo: string): Promise<Locacion[]> {
    const res = await fetch(`${API_BASE_URL}/locaciones/tipo/${encodeURIComponent(tipo)}`, { headers: AUTH_HEADERS });
    if (!res.ok) return [];
    return res.json();
  }

  async getLocacionesPorCuerpo(cuerpo: number | string): Promise<Locacion | null> {
    const res = await fetch(`${API_BASE_URL}/locaciones/cuerpo/${encodeURIComponent(cuerpo)}`, { headers: AUTH_HEADERS });
    if (!res.ok) return null;
    return res.json();
  }

  // ── ADMINISTRACIÓN DE EDIFICIOS (CRUD) ──────────────────────
  // La clave de administrador solo vive en memoria mientras el panel está
  // abierto (no se guarda en localStorage/sessionStorage, donde cualquier
  // script de la página podría leerla).
  private adminToken = '';

  /** Comprueba la clave con el backend o valida la clave maestra por defecto si el backend no está disponible. */
  async iniciarSesionAdmin(clave: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/verificar`, {
        method: 'POST',
        headers: adminHeaders(clave)
      });
      if (res.status === 429) throw new Error('Demasiados intentos. Espera unos minutos.');
      if (res.ok) {
        this.adminToken = clave;
        return true;
      }
      if (res.status === 401) {
        return false;
      }
    } catch (err: any) {
      if (err?.message?.includes('Demasiados intentos')) throw err;
      // Si el servidor backend no está iniciado (error de conexión / Failed to fetch),
      // permitimos el ingreso si coincide con la clave maestra configurada.
      if (clave === 'Inago_Mapa_26') {
        this.adminToken = clave;
        return true;
      }
      throw new Error(`No se pudo conectar con el servidor backend (${API_BASE_URL}). Si estás en desarrollo local, inicia el servidor backend con "npm start".`);
    }
    return false;
  }

  cerrarSesionAdmin(): void {
    this.adminToken = '';
  }

  get haySesionAdmin(): boolean {
    return this.adminToken.length > 0;
  }

  private async errorDeRespuesta(res: Response, porDefecto: string): Promise<Error> {
    if (res.status === 401) {
      this.adminToken = '';
      return new Error('La sesión de administrador no es válida. Vuelve a ingresar la clave.');
    }
    try {
      const data = await res.json();
      if (data?.error) return new Error(data.error);
    } catch { /* respuesta sin JSON */ }
    return new Error(porDefecto);
  }

  async crearEdificio(datos: { Nombre: string; Pisos?: string[] | string }): Promise<Edificio> {
    const res = await fetch(`${API_BASE_URL}/edificios`, {
      method: 'POST',
      headers: adminHeaders(this.adminToken),
      body: JSON.stringify(datos)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al crear edificio en el servidor');
    this.clearCache();
    return res.json();
  }

  async actualizarEdificio(id: string, datos: { Nombre?: string; Pisos?: string[] | string }): Promise<Edificio> {
    const res = await fetch(`${API_BASE_URL}/edificios/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: adminHeaders(this.adminToken),
      body: JSON.stringify(datos)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al actualizar edificio');
    this.clearCache();
    return res.json();
  }

  async eliminarEdificio(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE_URL}/edificios/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: adminHeaders(this.adminToken)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al eliminar edificio');
    this.clearCache();
    return true;
  }

  // ── ESTADO Y DIAGNÓSTICO DE FIREBASE ────────────────────────
  async getFirestoreStats(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/stats`, {
      headers: adminHeaders(this.adminToken)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al consultar estado de Firebase');
    return res.json();
  }

  async limpiarCacheBackend(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/cache/clear`, {
      method: 'POST',
      headers: adminHeaders(this.adminToken)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al limpiar caché');
    this.clearCache();
    return res.json();
  }

  // ── EXPLORADOR / CONSOLA FIRESTORE (STUDIO) ──────────────────
  async getFirestoreCollections(parentPath?: string): Promise<string[]> {
    const url = parentPath
      ? `${API_BASE_URL}/admin/firestore/collections?parentPath=${encodeURIComponent(parentPath)}`
      : `${API_BASE_URL}/admin/firestore/collections`;
    const res = await fetch(url, { headers: adminHeaders(this.adminToken) });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al listar colecciones de Firestore');
    return res.json();
  }

  async getFirestoreDocuments(collectionPath: string, limit: number = 100): Promise<{ collectionPath: string; count: number; documents: Array<{ id: string; path: string; data: any }> }> {
    const url = `${API_BASE_URL}/admin/firestore/documents?collectionPath=${encodeURIComponent(collectionPath)}&limit=${limit}`;
    const res = await fetch(url, { headers: adminHeaders(this.adminToken) });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al listar documentos');
    return res.json();
  }

  async getFirestoreDocument(documentPath: string): Promise<{ id: string; path: string; data: any; subcollections: string[] }> {
    const url = `${API_BASE_URL}/admin/firestore/document?documentPath=${encodeURIComponent(documentPath)}`;
    const res = await fetch(url, { headers: adminHeaders(this.adminToken) });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al obtener documento');
    return res.json();
  }

  async saveFirestoreDocument(params: { collectionPath?: string; documentPath?: string; docId?: string; data: any; merge?: boolean }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/firestore/document`, {
      method: 'POST',
      headers: adminHeaders(this.adminToken),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al guardar documento en Firestore');
    this.clearCache();
    return res.json();
  }

  async deleteFirestoreDocument(documentPath: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/firestore/document`, {
      method: 'DELETE',
      headers: adminHeaders(this.adminToken),
      body: JSON.stringify({ documentPath })
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al eliminar documento');
    this.clearCache();
    return res.json();
  }

  // ── GESTIÓN DE LOCACIONES Y SALAS ────────────────────────────
  async getLocacionesDetalladas(): Promise<{ total: number; locaciones: any[] }> {
    const res = await fetch(`${API_BASE_URL}/admin/locaciones/todas`, {
      headers: adminHeaders(this.adminToken)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al obtener locaciones detalladas');
    return res.json();
  }

  async crearLocacion(params: { edificioId: string; subcoleccion?: string; data: any; docId?: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/locaciones`, {
      method: 'POST',
      headers: adminHeaders(this.adminToken),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al crear locación');
    this.clearCache();
    return res.json();
  }

  async actualizarLocacion(params: { edificioId: string; subcoleccion: string; docId: string; data: any }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/locaciones`, {
      method: 'PUT',
      headers: adminHeaders(this.adminToken),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al actualizar locación');
    this.clearCache();
    return res.json();
  }

  async eliminarLocacion(params: { edificioId: string; subcoleccion: string; docId: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/locaciones`, {
      method: 'DELETE',
      headers: adminHeaders(this.adminToken),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al eliminar locación');
    this.clearCache();
    return res.json();
  }

  // ── GESTIÓN DE RUTAS Y NAVEGACIÓN ────────────────────────────
  async getRutasData(): Promise<{ navigationPaths: any[]; rutas: any[] }> {
    const res = await fetch(`${API_BASE_URL}/admin/rutas/todas`, {
      headers: adminHeaders(this.adminToken)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al obtener rutas');
    return res.json();
  }

  async saveRuta(params: { collection: string; docId?: string; data: any }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/rutas/document`, {
      method: 'POST',
      headers: adminHeaders(this.adminToken),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al guardar ruta');
    this.clearCache();
    return res.json();
  }

  async deleteRuta(params: { collection: string; docId: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/rutas/document`, {
      method: 'DELETE',
      headers: adminHeaders(this.adminToken),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await this.errorDeRespuesta(res, 'Error al eliminar ruta');
    this.clearCache();
    return res.json();
  }

  clearCache(): void {
    this.cache.clear();
  }
}
