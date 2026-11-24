const crypto = require('crypto');

/**
 * Protege SOLO las rutas que modifican datos (crear/editar/eliminar).
 *
 * Antes toda la API usaba un único API_TOKEN que además iba escrito en el
 * frontend (api.config.ts): cualquiera que abriera la página lo veía y, con
 * él, podía borrar edificios. Ahora:
 *   - Las lecturas del mapa son públicas (es información pública del campus).
 *   - Las escrituras exigen ADMIN_TOKEN, que vive SOLO en el .env del
 *     servidor. Los administradores lo escriben en el panel #admin; nunca
 *     queda guardado en el código del frontend.
 *
 * Cabecera esperada:  Authorization: Bearer <ADMIN_TOKEN>
 */
const LARGO_MINIMO = 24;

function compararSeguro(a, b) {
  // Se comparan los hash SHA-256 (mismo largo siempre) con timingSafeEqual:
  // así el tiempo de respuesta no revela cuántos caracteres acertó alguien.
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function requireAdmin(req, res, next) {
  const esperado = process.env.ADMIN_TOKEN;

  if (!esperado || esperado.length < LARGO_MINIMO) {
    console.error(`[adminAuth] ADMIN_TOKEN no configurado o con menos de ${LARGO_MINIMO} caracteres: escrituras deshabilitadas.`);
    return res.status(503).json({ error: 'La administración no está disponible en este momento.' });
  }

  const header = String(req.headers.authorization || '');
  const [tipo, token] = header.trim().split(/\s+/);

  if (!token || tipo.toLowerCase() !== 'bearer' || !compararSeguro(token, esperado)) {
    return res.status(401).json({ error: 'Credenciales de administrador inválidas.' });
  }

  next();
}

module.exports = { requireAdmin };
