/**
 * Servicio de acceso a la API (anteriormente consulta directa a Firestore).
 * Descripción: encapsula las consultas a la API backend para `Edificios`, `Locaciones` y `navigation-paths`.
 * Las comparaciones de nombres de campo (Piso/piso, Nombre/nombre, etc.) se hacen sin distinguir
 * mayúsculas/minúsculas mediante expresiones regulares.
 */
import { Injectable } from '@angular/core';
import {
  getEdificios,
  getLocaciones,
  getNavigationPaths,
  getRutas
} from './api.service';

const knownCollections = ['Edificios', 'navigation-paths', 'rutas'];
const collectionResultsCache = new Map<string, any[]>();

async function prefetchCollections(): Promise<void> {
  try {
    const [edificios, navPaths, rutas] = await Promise.all([
      getEdificios().catch(() => []),
      getNavigationPaths().catch(() => []),
      getRutas().catch(() => [])
    ]);
    collectionResultsCache.set('Edificios', edificios);
    collectionResultsCache.set('navigation-paths', navPaths);
    collectionResultsCache.set('rutas', rutas);
  } catch (error) {
    // no logging to avoid console noise in production
  }
}

void prefetchCollections();

// ── Búsqueda de campos sin distinguir mayúsculas/minúsculas ──────────────
function getFieldCI(obj: any, fieldName: string): any {
  if (!obj) return undefined;
  const regex = new RegExp(`^${fieldName}$`, 'i');
  const key = Object.keys(obj).find(k => regex.test(k?.toString().trim()));
  return key !== undefined ? obj[key] : undefined;
}

@Injectable({
  providedIn: 'root'
})
export class Firebase {
  constructor() {
    // No logging de colecciones para evitar ruido en consola.
  }

  private async fetchCollectionResults(collectionPath: string): Promise<any[]> {
    const cachedResults = collectionResultsCache.get(collectionPath);
    if (cachedResults) {
      return cachedResults;
    }

    let results: any[] = [];
    try {
      if (collectionPath === 'Edificios') {
        results = await getEdificios();
      } else if (collectionPath === 'navigation-paths') {
        results = await getNavigationPaths();
      } else if (collectionPath === 'rutas') {
        results = await getRutas();
      } else if (collectionPath.startsWith('Edificios/')) {
        const parts = collectionPath.split('/');
        const edificioId = parts[1];
        results = await getLocaciones(edificioId);
      }
    } catch (error) {
      return [];
    }

    collectionResultsCache.set(collectionPath, results);
    return results;
  }

  async getEdificios(): Promise<any[]> {
    return this.fetchCollectionResults('Edificios');
  }

  async getLocaciones(edificioId: string): Promise<any[]> {
    const rawLocaciones = await getLocaciones(edificioId).catch(() => []);
    return rawLocaciones.map((loc: any) => {
      const fallbackPiso = (loc._coleccion || '').includes('2')
        ? 'Piso 2'
        : (loc._coleccion || '').includes('3')
        ? 'Piso 3'
        : (loc._coleccion || '').includes('-1')
        ? 'Piso -1'
        : 'Piso 1';

      return {
        ...loc,
        _coleccionPiso: loc._coleccionPiso ?? fallbackPiso
      };
    });
  }

  async getLocacionesDeTodosLosEdificios(): Promise<any[]> {
    const edificios = await this.getEdificios();
    const allResults: any[] = [];

    for (const edificio of edificios as any[]) {
      const nombreEdificio = getFieldCI(edificio, 'nombre') ?? 'Edificio sin nombre';
      const locaciones = await this.getLocaciones(edificio.id);

      locaciones.forEach((loc: any) => {
        allResults.push({
          ...loc,
          _edificioId: edificio.id,
          _edificioNombre: nombreEdificio
        });
      });
    }

    return allResults;
  }

  async getLocacionesPorPiso(edificioId: string, piso: string): Promise<any[]> {
    const todas = await this.getLocaciones(edificioId);
    const pisoNormalizado = piso.trim().toLowerCase();

    return todas.filter((loc: any) => {
      const pisoValor = getFieldCI(loc, 'piso');
      return (pisoValor ?? '').toString().trim().toLowerCase() === pisoNormalizado;
    });
  }

  async getLocacionPorNombre(edificioId: string, piso: string, nombre: string): Promise<any> {
    const locaciones = await this.getLocacionesPorPiso(edificioId, piso);
    const normalized = nombre.trim().toLowerCase();

    return locaciones.find((loc: any) => {
      const nameValue = (getFieldCI(loc, 'nombre') ?? getFieldCI(loc, 'name') ?? '').toString().trim().toLowerCase();
      return nameValue === normalized;
    });
  }

  async getNavigationPaths(): Promise<any[]> {
    return this.fetchCollectionResults('navigation-paths');
  }

  private normalizeFloorKey(piso: string): string {
    const normalized = piso.toString().trim().toLowerCase().replace(/\s+/g, '');
    if (/^\d+$/.test(normalized)) {
      return `piso${normalized}`;
    }
    return normalized;
  }

  async getNavigationPath(piso: string, edificio?: string): Promise<any> {
    const todas = await this.getNavigationPaths();
    const pisoNormalizado = this.normalizeFloorKey(piso);
    const edificioNormalizado = edificio ? edificio.trim().toLowerCase() : '';

    return todas.find((doc: any) => {
      const pisoValor = getFieldCI(doc, 'Piso') ?? getFieldCI(doc, 'Piso ') ?? getFieldCI(doc, 'piso');
      const normalizedPiso = this.normalizeFloorKey((pisoValor ?? '').toString());
      if (normalizedPiso !== pisoNormalizado) {
        return false;
      }

      if (edificioNormalizado) {
        const edValor = (getFieldCI(doc, 'Edificio') ?? getFieldCI(doc, 'edificio') ?? '').toString().trim().toLowerCase();
        const matchesDirect = edValor === edificioNormalizado;
        const matchesWithWord = edValor.includes(`edificio${edificioNormalizado}`) || 
                                edValor.includes(`edificio ${edificioNormalizado}`);
        const matchesShort = edValor === `edificio${edificioNormalizado}` || 
                             edValor === `edificio ${edificioNormalizado}`;
                             
        if (!matchesDirect && !matchesWithWord && !matchesShort) {
          return false;
        }
      }

      return true;
    }) ?? null;
  }

  async getAllNavigationPaths(): Promise<any[]> {
    return this.getNavigationPaths();
  }

  async getNavigationPathsByEdificioYPiso(edificio: string, piso: string): Promise<any[]> {
    const todas = await this.getNavigationPaths();
    const pisoNormalizado = this.normalizeFloorKey(piso);
    const edificioNormalizado = edificio ? edificio.trim().toLowerCase() : '';

    return todas.filter((doc: any) => {
      const pisoValor = getFieldCI(doc, 'Piso') ?? getFieldCI(doc, 'Piso ') ?? getFieldCI(doc, 'piso');
      const normalizedPiso = this.normalizeFloorKey((pisoValor ?? '').toString());
      if (pisoNormalizado && normalizedPiso !== pisoNormalizado) {
        return false;
      }

      if (edificioNormalizado) {
        const edValor = (getFieldCI(doc, 'Edificio') ?? getFieldCI(doc, 'edificio') ?? '').toString().trim().toLowerCase();
        const matchesDirect = edValor === edificioNormalizado;
        const matchesWithWord = edValor.includes(`edificio${edificioNormalizado}`) || 
                                edValor.includes(`edificio ${edificioNormalizado}`);
        const matchesShort = edValor === `edificio${edificioNormalizado}` || 
                             edValor === `edificio ${edificioNormalizado}`;
                             
        if (!matchesDirect && !matchesWithWord && !matchesShort) {
          return false;
        }
      }

      return true;
    });
  }

  async printNavigationPathRawData(edificio?: string, piso?: string): Promise<void> {
    try {
      const paths = (edificio && piso) 
        ? await this.getNavigationPathsByEdificioYPiso(edificio, piso)
        : await this.getAllNavigationPaths();
      console.log('[DEBUG NavigationPaths Raw]', JSON.stringify(paths, null, 2));
    } catch (err) {
      console.error('[DEBUG NavigationPaths Error]', err);
    }
  }

  async getRutas(): Promise<any[]> {
    return this.fetchCollectionResults('rutas');
  }
}