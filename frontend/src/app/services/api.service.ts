const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const RAW_BASE_URL = isLocalhost ? 'http://localhost:3000' : 'https://api.inago.inacode.cl';
const BASE_URL = RAW_BASE_URL.replace(/\/$/, '');

// ── EDIFICIOS ──────────────────────────────────────────────
export async function getEdificios() {
    const res = await fetch(`${BASE_URL}/edificios`)
    if (!res.ok) throw new Error('Error al obtener edificios desde la API')
    return res.json()
}

export async function getEdificioPorNombre(nombre: string) {
    const res = await fetch(`${BASE_URL}/edificios/nombre/${encodeURIComponent(nombre)}`)
    if (!res.ok) throw new Error('Error al buscar edificio por nombre desde la API')
    return res.json()
}

export async function getEdificio(id: string) {
    const res = await fetch(`${BASE_URL}/edificios/${id}`)
    if (!res.ok) throw new Error('Error al buscar edificio desde la API')
    return res.json()
}

export async function crearEdificio(edificio: any) {
    const res = await fetch(`${BASE_URL}/edificios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edificio),
    })
    if (!res.ok) throw new Error('Error al crear edificio')
    return res.json()
}

export async function actualizarEdificio(id: string, datosActualizados: any) {
    const res = await fetch(`${BASE_URL}/edificios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizados),
    })
    if (!res.ok) throw new Error('Error al actualizar edificio')
    return res.json()
}

export async function eliminarEdificio(id: string) {
    const res = await fetch(`${BASE_URL}/edificios/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error al eliminar edificio')
    return res.json()
}

// ── LOCACIONES — búsqueda global (sin necesitar ID de edificio) ──
export async function getLocacionPorNombre(nombre: string) {
    const res = await fetch(`${BASE_URL}/locaciones/${encodeURIComponent(nombre)}`)
    if (!res.ok) throw new Error('Error al buscar locación por nombre desde la API')
    return res.json()
}

export async function getLocacionesPorPiso(piso: string) {
    const res = await fetch(`${BASE_URL}/locaciones/piso/${encodeURIComponent(piso)}`)
    if (!res.ok) throw new Error('Error al buscar locaciones por piso desde la API')
    return res.json()
}

// NUEVO — búsqueda global por tipo
export async function getLocacionesPorTipo(tipo: string) {
    const res = await fetch(`${BASE_URL}/locaciones/tipo/${encodeURIComponent(tipo)}`)
    if (!res.ok) throw new Error('Error al buscar locaciones por tipo desde la API')
    return res.json()
}

// NUEVO — búsqueda global por número de cuerpo
export async function getLocacionesPorCuerpo(cuerpo: number | string) {
    const res = await fetch(`${BASE_URL}/locaciones/cuerpo/${cuerpo}`)
    if (!res.ok) throw new Error('Error al buscar locaciones por cuerpo desde la API')
    return res.json()
}

// ── LOCACIONES — dentro de un edificio puntual ────────────────
export async function getLocaciones(edificioId: string) {
    const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones`)
    if (!res.ok) throw new Error('Error al obtener locaciones desde la API')
    return res.json()
}

export async function crearLocacion(edificioId: string, locacion: any) {
    const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locacion),
    })
    if (!res.ok) throw new Error('Error al crear locación')
    return res.json()
}

export async function actualizarLocacion(edificioId: string, locId: string, datosActualizados: any) {
    const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones/${locId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizados),
    })
    if (!res.ok) throw new Error('Error al actualizar locación')
    return res.json()
}

export async function eliminarLocacion(edificioId: string, locId: string) {
    const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones/${locId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error al eliminar locación')
    return res.json()
}

// ── NAVIGATION PATHS ───────────────────────────────────────
export async function getNavigationPaths() {
    const res = await fetch(`${BASE_URL}/navigation-paths`)
    if (!res.ok) throw new Error('Error al obtener navigation-paths desde la API')
    return res.json()
}

export async function getNavigationPathPorPiso(piso: string) {
    const res = await fetch(`${BASE_URL}/navigation-paths/piso/${encodeURIComponent(piso)}`)
    if (!res.ok) throw new Error('Error al obtener navigation-path desde la API')
    return res.json()
}

export async function crearNavigationPath(navPath: any) {
    const res = await fetch(`${BASE_URL}/navigation-paths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(navPath),
    })
    if (!res.ok) throw new Error('Error al crear navigation-path')
    return res.json()
}

export async function actualizarNavigationPath(id: string, datosActualizados: any) {
    const res = await fetch(`${BASE_URL}/navigation-paths/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizados),
    })
    if (!res.ok) throw new Error('Error al actualizar navigation-path')
    return res.json()
}

export async function eliminarNavigationPath(id: string) {
    const res = await fetch(`${BASE_URL}/navigation-paths/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error al eliminar navigation-path')
    return res.json()
}

// ── RUTA MÁS CORTA ─────────────────────────────────────────
export async function getRutaHaciaDestino(destino: string) {
    const res = await fetch(`${BASE_URL}/ruta/${encodeURIComponent(destino)}`)
    if (!res.ok) throw new Error('Error al calcular la ruta desde la API')
    return res.json()
}

// ── RUTAS (colección antigua) ──────────────────────────────
// NOTA: colección "rutas" reemplazada por "navigation-paths" + cálculo
// de ruta más corta. Se deja por si se necesita más adelante.
export async function getRutas() {
    const res = await fetch(`${BASE_URL}/rutas`)
    if (!res.ok) throw new Error('Error al obtener rutas desde la API')
    return res.json()
}