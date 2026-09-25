import { Injectable } from '@angular/core';
import { API_BASE_URL, AUTH_HEADERS } from '../core/config/api.config';
import { Edificio } from '../core/models/edificio.model';
import { Locacion } from '../core/models/locacion.model';

@Injectable({
  providedIn: 'root'
})
export class EspaciosApiService {
  private cache = new Map<string, any>();

  // ── EDIFICIOS ───────────────────────────────────────────────
  async getEdificios(): Promise<Edificio[]> {
    const cacheKey = 'edificios';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    const res = await fetch(`${API_BASE_URL}/edificios`, { headers: AUTH_HEADERS });
    if (!res.ok) throw new Error('Error al obtener edificios desde la API');
    const data: Edificio[] = await res.json();
    this.cache.set(cacheKey, data);
    return data;
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
    const cacheKey = `locaciones:${edificioId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    const res = await fetch(`${API_BASE_URL}/edificios/${encodeURIComponent(edificioId)}/locaciones`, { headers: AUTH_HEADERS });
    if (!res.ok) return [];
    const data: Locacion[] = await res.json();
    this.cache.set(cacheKey, data);
    return data;
  }

  async getLocacionesDeTodosLosEdificios(): Promise<Locacion[]> {
    const cacheKey = 'locaciones:todas';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const edificios = await this.getEdificios();
    const results: Locacion[] = [];

    await Promise.all(
      edificios.map(async (ed) => {
        const locs = await this.getLocacionesDeEdificio(ed.id);
        const edNombre = ed.Nombre || ed.nombre || `Edificio ${ed.id}`;
        locs.forEach((loc) => {
          results.push({
            ...loc,
            _edificioId: ed.id,
            _edificioNombre: edNombre
          });
        });
      })
    );

    this.cache.set(cacheKey, results);
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

  clearCache(): void {
    this.cache.clear();
  }
}
