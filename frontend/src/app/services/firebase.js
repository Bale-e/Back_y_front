import { __esDecorate, __runInitializers } from "tslib";
/**
 * Servicio de acceso a la API (anteriormente consulta directa a Firestore).
 * Descripción: encapsula las consultas a la API backend para `Edificios`, `Locaciones` y `navigation-paths`.
 * Las comparaciones de nombres de campo (Piso/piso, Nombre/nombre, etc.) se hacen sin distinguir
 * mayúsculas/minúsculas mediante expresiones regulares.
 */
import { Injectable } from '@angular/core';
import { getEdificios, getLocaciones, getNavigationPaths, getRutas } from './api.service';
const knownCollections = ['Edificios', 'navigation-paths', 'rutas'];
const collectionResultsCache = new Map();
async function prefetchCollections() {
    try {
        const [edificios, navPaths, rutas] = await Promise.all([
            getEdificios().catch(() => []),
            getNavigationPaths().catch(() => []),
            getRutas().catch(() => [])
        ]);
        collectionResultsCache.set('Edificios', edificios);
        collectionResultsCache.set('navigation-paths', navPaths);
        collectionResultsCache.set('rutas', rutas);
    }
    catch (error) {
        // no logging to avoid console noise in production
    }
}
void prefetchCollections();
// ── Búsqueda de campos sin distinguir mayúsculas/minúsculas ──────────────
function getFieldCI(obj, fieldName) {
    if (!obj)
        return undefined;
    const regex = new RegExp(`^${fieldName}$`, 'i');
    const key = Object.keys(obj).find(k => regex.test(k?.toString().trim()));
    return key !== undefined ? obj[key] : undefined;
}
let Firebase = (() => {
    let _classDecorators = [Injectable({
            providedIn: 'root'
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Firebase = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            Firebase = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        constructor() {
            // No logging de colecciones para evitar ruido en consola.
        }
        async fetchCollectionResults(collectionPath) {
            const cachedResults = collectionResultsCache.get(collectionPath);
            if (cachedResults) {
                return cachedResults;
            }
            let results = [];
            try {
                if (collectionPath === 'Edificios') {
                    results = await getEdificios();
                }
                else if (collectionPath === 'navigation-paths') {
                    results = await getNavigationPaths();
                }
                else if (collectionPath === 'rutas') {
                    results = await getRutas();
                }
                else if (collectionPath.startsWith('Edificios/')) {
                    const parts = collectionPath.split('/');
                    const edificioId = parts[1];
                    results = await getLocaciones(edificioId);
                }
            }
            catch (error) {
                return [];
            }
            collectionResultsCache.set(collectionPath, results);
            return results;
        }
        async getEdificios() {
            return this.fetchCollectionResults('Edificios');
        }
        async getLocaciones(edificioId) {
            const rawLocaciones = await getLocaciones(edificioId).catch(() => []);
            return rawLocaciones.map((loc) => {
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
        async getLocacionesDeTodosLosEdificios() {
            const edificios = await this.getEdificios();
            const allResults = [];
            for (const edificio of edificios) {
                const nombreEdificio = getFieldCI(edificio, 'nombre') ?? 'Edificio sin nombre';
                const locaciones = await this.getLocaciones(edificio.id);
                locaciones.forEach((loc) => {
                    allResults.push({
                        ...loc,
                        _edificioId: edificio.id,
                        _edificioNombre: nombreEdificio
                    });
                });
            }
            return allResults;
        }
        async getLocacionesPorPiso(edificioId, piso) {
            const todas = await this.getLocaciones(edificioId);
            const pisoNormalizado = piso.trim().toLowerCase();
            return todas.filter((loc) => {
                const pisoValor = getFieldCI(loc, 'piso');
                return (pisoValor ?? '').toString().trim().toLowerCase() === pisoNormalizado;
            });
        }
        async getLocacionPorNombre(edificioId, piso, nombre) {
            const locaciones = await this.getLocacionesPorPiso(edificioId, piso);
            const normalized = nombre.trim().toLowerCase();
            return locaciones.find((loc) => {
                const nameValue = (getFieldCI(loc, 'nombre') ?? getFieldCI(loc, 'name') ?? '').toString().trim().toLowerCase();
                return nameValue === normalized;
            });
        }
        async getNavigationPaths() {
            return this.fetchCollectionResults('navigation-paths');
        }
        normalizeFloorKey(piso) {
            const normalized = piso.toString().trim().toLowerCase().replace(/\s+/g, '');
            if (/^\d+$/.test(normalized)) {
                return `piso${normalized}`;
            }
            return normalized;
        }
        async getNavigationPath(piso, edificio) {
            const todas = await this.getNavigationPaths();
            const pisoNormalizado = this.normalizeFloorKey(piso);
            const edificioNormalizado = edificio ? edificio.trim().toLowerCase() : '';
            return todas.find((doc) => {
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
        async getAllNavigationPaths() {
            return this.getNavigationPaths();
        }
        async getNavigationPathsByEdificioYPiso(edificio, piso) {
            const todas = await this.getNavigationPaths();
            const pisoNormalizado = this.normalizeFloorKey(piso);
            const edificioNormalizado = edificio ? edificio.trim().toLowerCase() : '';
            return todas.filter((doc) => {
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
        async printNavigationPathRawData(edificio, piso) {
            try {
                const paths = (edificio && piso)
                    ? await this.getNavigationPathsByEdificioYPiso(edificio, piso)
                    : await this.getAllNavigationPaths();
                console.log('[DEBUG NavigationPaths Raw]', JSON.stringify(paths, null, 2));
            }
            catch (err) {
                console.error('[DEBUG NavigationPaths Error]', err);
            }
        }
        async getRutas() {
            return this.fetchCollectionResults('rutas');
        }
    };
    return Firebase = _classThis;
})();
export { Firebase };
