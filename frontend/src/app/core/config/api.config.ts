/**
 * Configuración de la URL base del API Backend para consumo REST exclusivo.
 */
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = (
  isLocalhost ? 'http://localhost:3000' : 'https://api.inago.inacode.cl'
).replace(/\/$/, '');

/**
 * Token de autorización configurado para realizar solicitudes GET a la API
 */
export const API_TOKEN = 'inago_sec_7f9c2d1b8e4a053f6e8d2b1a9c4e7f0b5d3a6c8e1f4b2a9d7c0e5f8b1a3d6e9f';

export const AUTH_HEADERS: HeadersInit = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json'
};
