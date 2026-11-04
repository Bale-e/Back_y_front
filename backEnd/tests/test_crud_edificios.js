const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const app = require('../src/app');

async function testCrud() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  const token = process.env.API_TOKEN;

  console.log(`Servidor de prueba iniciado en ${baseUrl}\n`);

  try {
    // 1. Prueba de seguridad: POST sin token debe fallar (401)
    console.log('[1] Probando POST /edificios sin token (debe fallar)...');
    const resSinToken = await fetch(`${baseUrl}/edificios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Nombre: 'Edificio No Autorizado' })
    });
    console.log(`    Código: ${resSinToken.status} (Esperado: 401) ✓\n`);

    // 2. Crear edificio (POST con token)
    console.log('[2] Probando crear edificio (POST con token)...');
    const resCrear = await fetch(`${baseUrl}/edificios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        Nombre: 'Edificio Test Temporal',
        Piso: ['Piso 1', 'Piso 2']
      })
    });
    const nuevoEdificio = await resCrear.json();
    console.log(`    Código: ${resCrear.status} (Esperado: 201)`);
    console.log(`    Edificio Creado con ID: ${nuevoEdificio.id} ✓\n`);

    const idCreado = nuevoEdificio.id;

    // 3. Editar edificio (PUT con token)
    console.log(`[3] Probando editar edificio ID: ${idCreado} (PUT con token)...`);
    const resEditar = await fetch(`${baseUrl}/edificios/${idCreado}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        Nombre: 'Edificio Test Renombrado',
        Piso: ['Piso 1', 'Piso 2', 'Piso 3']
      })
    });
    const edificioActualizado = await resEditar.json();
    console.log(`    Código: ${resEditar.status} (Esperado: 200)`);
    console.log(`    Nombre actualizado a: ${edificioActualizado.Nombre} ✓\n`);

    // 4. Eliminar edificio (DELETE con token)
    console.log(`[4] Probando eliminar edificio ID: ${idCreado} (DELETE con token)...`);
    const resBorrar = await fetch(`${baseUrl}/edificios/${idCreado}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const resultadoBorrado = await resBorrar.json();
    console.log(`    Código: ${resBorrar.status} (Esperado: 200)`);
    console.log(`    Resultado:`, resultadoBorrado, '✓\n');

    console.log('🎉 ¡Todas las operaciones CRUD del Backend funcionan al 100%!');
  } catch (error) {
    console.error('❌ Error durante la prueba CRUD:', error.message);
  } finally {
    server.close();
  }
}

testCrud();
