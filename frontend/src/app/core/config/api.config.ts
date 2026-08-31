/**
 * Configuración de la URL base del API Backend para consumo REST exclusivo.
 */
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = (
  isLocalhost ? 'http://localhost:3000' : 'https://api.inago.inacode.cl'
).replace(/\/$/, '');
