const ValidationError = require('../../../../shared/domain/errors/ValidationError');

/**
 * Antes POST/PUT /edificios guardaban req.body tal cual en Firestore:
 * cualquier campo, de cualquier tipo y tamaño (incluido HTML que después el
 * mapa mostraba). Ahora solo se aceptan los campos que usa el panel, con
 * tipo y largo controlados; lo demás se rechaza.
 */
const CAMPOS_PERMITIDOS = new Set(['Nombre', 'nombre', 'descripcion', 'Pisos', 'pisos', 'Piso', 'cuerpo', 'Cuerpo']);
const TEXTO_SEGURO = /^[\p{L}\p{N} .,()\-_/º°#]+$/u;

function textoValido(valor, max) {
  return typeof valor === 'string' && valor.trim().length > 0 && valor.length <= max && TEXTO_SEGURO.test(valor);
}

function validarEdificio({ parcial = false } = {}) {
  return (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return next(new ValidationError('El cuerpo de la solicitud debe ser un objeto JSON.'));
    }

    const desconocidos = Object.keys(body).filter((k) => !CAMPOS_PERMITIDOS.has(k));
    if (desconocidos.length) {
      return next(new ValidationError(`Campos no permitidos: ${desconocidos.join(', ')}`));
    }

    const limpio = {};
    const nombre = body.Nombre ?? body.nombre;
    if (nombre !== undefined) {
      if (!textoValido(nombre, 100)) return next(new ValidationError('Nombre inválido (máx. 100 caracteres, sin símbolos especiales).'));
      limpio.Nombre = nombre.trim();
    } else if (!parcial) {
      return next(new ValidationError('El nombre del edificio es obligatorio.'));
    }

    if (body.descripcion !== undefined) {
      if (typeof body.descripcion !== 'string' || body.descripcion.length > 500 || /[<>]/.test(body.descripcion)) {
        return next(new ValidationError('Descripción inválida (máx. 500 caracteres, sin < ni >).'));
      }
      limpio.descripcion = body.descripcion.trim();
    }

    const pisos = body.Pisos ?? body.pisos ?? body.Piso;
    if (pisos !== undefined) {
      const lista = Array.isArray(pisos) ? pisos : [pisos];
      if (lista.length === 0 || lista.length > 20 || !lista.every((p) => textoValido(p, 50))) {
        return next(new ValidationError('Pisos inválidos (entre 1 y 20, cada uno de máx. 50 caracteres).'));
      }
      // Se guardan en las dos claves que lee el frontend actual.
      limpio.Pisos = lista.map((p) => p.trim());
      limpio.Piso = limpio.Pisos;
    }

    const cuerpo = body.cuerpo ?? body.Cuerpo;
    if (cuerpo !== undefined && cuerpo !== null) {
      const valido = (typeof cuerpo === 'number' && Number.isInteger(cuerpo) && cuerpo >= 0 && cuerpo < 10000)
        || textoValido(cuerpo, 20);
      if (!valido) return next(new ValidationError('Cuerpo inválido.'));
      limpio.cuerpo = cuerpo;
    }

    if (Object.keys(limpio).length === 0) {
      return next(new ValidationError('No hay campos para guardar.'));
    }

    req.body = limpio;
    next();
  };
}

// IDs de documento de Firestore: alfanuméricos (sin "/" que cambiaría la ruta).
function validarIdDocumento(req, res, next) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(String(req.params.id || ''))) {
    return next(new ValidationError('ID de edificio inválido.'));
  }
  next();
}

module.exports = { validarEdificio, validarIdDocumento };
