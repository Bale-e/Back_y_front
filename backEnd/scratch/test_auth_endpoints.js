require('dotenv').config();
const http = require('http');
const app = require('../src/app');

async function probarAutenticacion() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  const tokenValido = 'inago_sec_7f9c2d1b8e4a053f6e8d2b1a9c4e7f0b5d3a6c8e1f4b2a9d7c0e5f8b1a3d6e9f';

  console.log('Iniciando pruebas de seguridad del Token...\n');

  // Caso 1: Healthcheck debe funcionar sin token (Público)
  const resHealth = await fetch(`${baseUrl}/health`);
  console.log(`[1] GET /health (sin token) -> Código: ${resHealth.status} (Esperado: 200)`);

  // Caso 2: Petición GET sin token (Debe fallar con 401)
  const resSinToken = await fetch(`${baseUrl}/edificios`);
  const dataSinToken = await resSinToken.json();
  console.log(`[2] GET /edificios (sin token) -> Código: ${resSinToken.status} (Esperado: 401)`);
  console.log('    Respuesta de la API:', dataSinToken.error);

  // Caso 3: Petición GET con token incorrecto (Debe fallar con 401)
  const resTokenMalo = await fetch(`${baseUrl}/edificios`, {
    headers: { 'Authorization': 'Bearer token_falso_123' }
  });
  const dataTokenMalo = await resTokenMalo.json();
  console.log(`[3] GET /edificios (token falso) -> Código: ${resTokenMalo.status} (Esperado: 401)`);
  console.log('    Respuesta de la API:', dataTokenMalo.error);

  // Caso 4: Petición GET con token válido registrado en Firestore (Debe tener éxito con 200)
  const resConToken = await fetch(`${baseUrl}/edificios`, {
    headers: { 'Authorization': `Bearer ${tokenValido}` }
  });
  const dataConToken = await resConToken.json();
  console.log(`[4] GET /edificios (token válido) -> Código: ${resConToken.status} (Esperado: 200)`);
  console.log(`    Edificios obtenidos: ${Array.isArray(dataConToken) ? dataConToken.length : 'OK'}`);

  server.close();
  console.log('\n✅ ¡Pruebas del Backend finalizadas con éxito!');
}

probarAutenticacion().catch(console.error);
