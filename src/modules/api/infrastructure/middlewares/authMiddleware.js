require('dotenv').config();

/**
 * Middleware para validar que las solicitudes a la API incluyan
 * un token de autorización válido en la cabecera HTTP:
 * Authorization: Bearer <TOKEN>
 * 
 * Se valida directamente contra la variable de entorno API_TOKEN,
 * manteniendo la base de datos Firestore limpia y libre de colecciones extra.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      error: 'Acceso no autorizado: no se proporcionó el token en la cabecera Authorization'
    });
  }

  // Soporta formato estándar "Bearer <token>" o el token directo
  const partes = authHeader.trim().split(' ');
  const token = partes.length === 2 && partes[0].toLowerCase() === 'bearer' ? partes[1] : partes[0];

  if (!token) {
    return res.status(401).json({
      error: 'Acceso no autorizado: formato de token no válido'
    });
  }

  const tokenEsperado = process.env.API_TOKEN;

  // Validación de seguridad por si falta la variable en el .env
  if (!tokenEsperado) {
    return res.status(500).json({
      error: 'Error interno: API_TOKEN no configurado en las variables de entorno (.env)'
    });
  }

  // Comparamos el token recibido con el token de entorno
  if (token !== tokenEsperado) {
    return res.status(401).json({
      error: 'Acceso no autorizado: el token es inválido'
    });
  }

  // Token válido: permitimos la ejecución y consulta a Firestore
  next();
}

module.exports = { authMiddleware };
