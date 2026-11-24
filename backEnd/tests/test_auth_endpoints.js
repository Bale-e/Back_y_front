// Pruebas del modelo de acceso (2026-11-24):
//   - Lecturas del mapa: públicas.
//   - Escrituras (POST/PUT/DELETE /edificios): exigen ADMIN_TOKEN del .env.
//   - El cuerpo de las escrituras se valida antes de tocar Firestore.
// Ninguno de estos casos escribe en Firestore.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const assert = require('assert');
const app = require('../src/app');

async function probar() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://localhost:${server.address().port}`;
  const admin = process.env.ADMIN_TOKEN;
  const json = { 'Content-Type': 'application/json' };
  const casos = [];
  const caso = async (nombre, esperado, promesa) => {
    const res = await promesa;
    casos.push({ nombre, esperado, obtenido: res.status });
    assert.strictEqual(res.status, esperado, `${nombre}: esperado ${esperado}, obtenido ${res.status}`);
  };

  try {
    await caso('GET /health público', 200, fetch(`${baseUrl}/health`));
    await caso('GET /edificios sin token (lectura pública)', 200, fetch(`${baseUrl}/edificios`));
    await caso('POST /edificios sin token', 401, fetch(`${baseUrl}/edificios`, { method: 'POST', headers: json, body: JSON.stringify({ Nombre: 'X' }) }));
    await caso('POST /edificios con token falso', 401, fetch(`${baseUrl}/edificios`, { method: 'POST', headers: { ...json, Authorization: 'Bearer token_falso_123' }, body: JSON.stringify({ Nombre: 'X' }) }));
    await caso('DELETE /edificios/x sin token', 401, fetch(`${baseUrl}/edificios/x`, { method: 'DELETE' }));
    await caso('POST /admin/verificar con token falso', 401, fetch(`${baseUrl}/admin/verificar`, { method: 'POST', headers: { Authorization: 'Bearer token_falso_123' } }));

    if (admin) {
      const auth = { ...json, Authorization: `Bearer ${admin}` };
      await caso('POST /admin/verificar con ADMIN_TOKEN', 200, fetch(`${baseUrl}/admin/verificar`, { method: 'POST', headers: auth }));
      await caso('POST /edificios con campo no permitido', 400, fetch(`${baseUrl}/edificios`, { method: 'POST', headers: auth, body: JSON.stringify({ Nombre: 'Edificio Z', hack: 1 }) }));
      await caso('POST /edificios con HTML en el nombre', 400, fetch(`${baseUrl}/edificios`, { method: 'POST', headers: auth, body: JSON.stringify({ Nombre: '<img src=x onerror=alert(1)>' }) }));
      await caso('POST /edificios sin nombre', 400, fetch(`${baseUrl}/edificios`, { method: 'POST', headers: auth, body: JSON.stringify({ Pisos: ['Piso 1'] }) }));
      await caso('PUT /edificios con ID inválido', 400, fetch(`${baseUrl}/edificios/a..b`, { method: 'PUT', headers: auth, body: JSON.stringify({ Nombre: 'Edificio Z' }) }));
    } else {
      console.warn('ADMIN_TOKEN no configurado: se omiten los casos con clave válida.');
    }

    casos.forEach((c) => console.log(`✓ ${c.nombre} -> ${c.obtenido}`));
    console.log(`\n${casos.length} casos OK`);
  } finally {
    server.close();
  }
}

probar().catch((e) => { console.error('✗', e.message); process.exit(1); });
