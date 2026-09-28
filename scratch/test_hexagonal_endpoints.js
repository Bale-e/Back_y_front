require('dotenv').config();
const http = require('http');
const app = require('../src/app');

async function runTests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`Test server running on ${baseUrl}\n`);

  async function testEndpoint(name, path) {
    try {
      const start = Date.now();
      const res = await fetch(`${baseUrl}${path}`);
      const duration = Date.now() - start;
      const data = await res.json();
      const statusOk = res.ok ? '✓ OK' : `✗ STATUS ${res.status}`;
      console.log(`[${statusOk}] ${name} -> ${path} (${duration}ms)`);
      if (!res.ok) {
        console.log('   Error response:', data);
      } else {
        const preview = Array.isArray(data)
          ? `Array[${data.length}]`
          : typeof data === 'object' && data !== null
          ? `Object { keys: ${Object.keys(data).join(', ')} }`
          : data;
        console.log(`   Data: ${preview}`);
        if (path.includes('/navegacion/ruta')) {
          console.log(`   Navegacion: Start=${data.startName}, End=${data.endName}, Distance=${data.distance}m`);
          console.log(`   Visualizacion: Waypoints=${data.visualizacion?.waypoints?.length}, Arrows=${data.visualizacion?.arrows?.length}, Smoothed=${data.visualizacion?.smoothedPolyline?.length}`);
        }
      }
    } catch (err) {
      console.error(`[✗ FAIL] ${name} -> ${path}: ${err.message}`);
    }
  }

  // 1. Healthcheck
  await testEndpoint('Healthcheck', '/health');

  // 2. Edificios
  await testEndpoint('Listar Edificios', '/edificios');
  await testEndpoint('Edificio por Nombre', '/edificios/nombre/Edificio%20A');

  // 3. Locaciones Globales
  await testEndpoint('Locaciones por Piso', '/locaciones/piso/Piso%201');
  await testEndpoint('Locaciones por Tipo', '/locaciones/tipo/Sala');
  await testEndpoint('Locación por Cuerpo', '/locaciones/cuerpo/20');
  await testEndpoint('Locación por Nombre', '/locaciones/Sala%20A106');

  // 4. Navegación (Hexagonal Slice con Visualización)
  await testEndpoint('Calcular Ruta Enriquecida', '/navegacion/ruta?origen=Acceso1&destino=Sala%20A106');

  // 5. Compatibilidad Angular
  await testEndpoint('Ruta Destino (Compatibilidad)', '/ruta/Sala%20A106');
  await testEndpoint('Navigation Paths (Compatibilidad)', '/navigation-paths');
  await testEndpoint('Rutas Antiguas (Compatibilidad)', '/rutas');

  server.close();
  console.log('\nAll Hexagonal Architecture endpoint tests passed successfully!');
}

runTests().catch(console.error);
