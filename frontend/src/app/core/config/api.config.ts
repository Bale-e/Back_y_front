/**
 * Configuración de la URL base del API Backend para consumo REST exclusivo.
 */
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = (
  isLocalhost ? 'http://127.0.0.1:3000' : 'https://api.inago.inacode.cl'
).replace(/\/$/, '');

/**
 * Cabeceras para las lecturas del mapa (públicas, sin token).
 *
 * Antes aquí había un API_TOKEN escrito en el código: terminaba dentro del
 * JavaScript que descarga cualquier visitante, así que no protegía nada y
 * además permitía modificar datos. Las escrituras ahora usan la clave de
 * administrador que se escribe en el panel #admin (ver admin-panel.component.ts),
 * que nunca queda guardada en el código.
 */
export const AUTH_HEADERS: HeadersInit = {
  'Content-Type': 'application/json'
};

/** Cabeceras para crear/editar/eliminar: llevan la clave de administrador. */
export function adminHeaders(adminToken: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };
}
