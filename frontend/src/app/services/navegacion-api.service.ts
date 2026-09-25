import { Injectable } from '@angular/core';
import { API_BASE_URL, AUTH_HEADERS } from '../core/config/api.config';
import { RouteResult, NavigationPath } from '../core/models/navegacion.model';

@Injectable({
  providedIn: 'root'
})
export class NavegacionApiService {
  private cache = new Map<string, any>();

  // ── CÁLCULO DE RUTA ENRIQUECIDA (BACKEND HEXAGONAL) ─────────
  async getRutaEnriquecida(
    destino: string,
    options: { origen?: string; piso?: string; edificio?: string } = {}
  ): Promise<RouteResult | null> {
    const params = new URLSearchParams({ destino });
    if (options.origen) params.append('origen', options.origen);
    if (options.piso) params.append('piso', options.piso);
    if (options.edificio) params.append('edificio', options.edificio);

    const res = await fetch(`${API_BASE_URL}/navegacion/ruta?${params.toString()}`, { headers: AUTH_HEADERS });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Error al calcular ruta enriquecida desde el backend');
    }
    return res.json();
  }

  // ── RUTA HASTA DESTINO DIRECTA ──────────────────────────────
  async getRutaHaciaDestino(destino: string, origen?: string): Promise<RouteResult | null> {
    const url = origen
      ? `${API_BASE_URL}/ruta/${encodeURIComponent(destino)}?origen=${encodeURIComponent(origen)}`
      : `${API_BASE_URL}/ruta/${encodeURIComponent(destino)}`;
    const res = await fetch(url, { headers: AUTH_HEADERS });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Error al obtener ruta hacia destino');
    }
    return res.json();
  }

  // ── NAVIGATION PATHS (TOPOLOGÍA DE PISOS) ───────────────────
  async getNavigationPaths(): Promise<NavigationPath[]> {
    const cacheKey = 'navigation-paths';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    const res = await fetch(`${API_BASE_URL}/navigation-paths`, { headers: AUTH_HEADERS });
    if (!res.ok) return [];
    const data: NavigationPath[] = await res.json();
    this.cache.set(cacheKey, data);
    return data;
  }

  async getNavigationPathsByEdificioYPiso(edificio: string, piso: string): Promise<NavigationPath[]> {
    const all = await this.getNavigationPaths();
    const pisoNormalizado = piso.toString().trim().toLowerCase().replace(/\s+/g, '');
    const edificioNormalizado = edificio ? edificio.trim().toLowerCase() : '';

    return all.filter((doc: any) => {
      const p = (doc.Piso ?? doc['Piso '] ?? doc.piso ?? '').toString().trim().toLowerCase().replace(/\s+/g, '');
      if (pisoNormalizado && p && !p.includes(pisoNormalizado) && !pisoNormalizado.includes(p)) {
        return false;
      }
      if (edificioNormalizado) {
        const ed = (doc.Edificio ?? doc.edificio ?? '').toString().trim().toLowerCase();
        if (ed && !ed.includes(edificioNormalizado) && !edificioNormalizado.includes(ed)) {
          return false;
        }
      }
      return true;
    });
  }
}
