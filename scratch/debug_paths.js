/**
 * Script de diagnóstico: imprime la estructura real de los navigation-paths
 * de Firestore para entender cómo están organizados los giros y conexiones.
 * 
 * Uso: node scratch/debug_paths.js
 */
require('dotenv').config();
require('../src/shared/infrastructure/firebase/firebaseAdmin');

const navigationRepository = require('../src/modules/sistema_navegacion/infrastructure/repositories/FirestoreNavigationRepository');
const calcRuta = require('../src/modules/sistema_navegacion/application/use-cases/CalcularRutaUseCase');

function extractVec3Point(obj) {
  if (!obj) return null;
  if (Array.isArray(obj) && obj.length >= 3) {
    return { x: Number(obj[0]), y: Number(obj[1]), z: Number(obj[2]) };
  }
  if (typeof obj === 'object') {
    const src = obj.Coordenadas3D || obj['Coordenadas 3D'] || obj.Coordenadas || obj.coordenadas || obj;
    const getVal = (f) => {
      const k = Object.keys(src || {}).find(key => key.toLowerCase() === f.toLowerCase());
      return k !== undefined ? Number(src[k]) : NaN;
    };
    const x = getVal('x'), y = getVal('y'), z = getVal('z');
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) return { x, y, z };
  }
  return null;
}

async function main() {
  const paths = await navigationRepository.obtenerTodosLosPaths();
  console.log(`\n=== Total navigation-paths en Firestore: ${paths.length} ===\n`);

  for (const p of paths) {
    const piso = p.Piso || p.piso || p['Piso '] || '?';
    const edificio = p.Edificio || p.edificio || '?';
    console.log(`--- Path ID: ${p.id} | Edificio: ${edificio} | Piso: ${piso} ---`);

    // Accesos
    const accesosData = p.Accesos || p.accesos;
    const accesos = {};
    if (accesosData) {
      const entries = Array.isArray(accesosData)
        ? accesosData.map((v, i) => [`Acceso${i+1}`, v])
        : Object.entries(accesosData);
      entries.forEach(([k, v]) => {
        const pt = extractVec3Point(v);
        if (pt) accesos[k] = pt;
      });
    }
    console.log(`  Accesos (${Object.keys(accesos).length}): ${Object.entries(accesos).map(([k,v]) => `${k}=(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)})`).join(' | ')}`);

    // Giros (con claves originales para ver el orden)
    const girosData = p.Giros || p.giros || p.Turns || p.turns;
    const girosKeys = girosData
      ? (Array.isArray(girosData) ? girosData.map((_,i) => `[${i}]`) : Object.keys(girosData))
      : [];
    const girosArr = girosData
      ? (Array.isArray(girosData) ? girosData : Object.values(girosData)).map(v => extractVec3Point(v)).filter(Boolean)
      : [];
    console.log(`  Giros (${girosArr.length}) [claves: ${girosKeys.join(', ')}]:`);
    girosArr.forEach((g, i) => {
      console.log(`    [${i}] ${girosKeys[i] || i}: (${g.x.toFixed(2)}, ${g.y.toFixed(2)}, ${g.z.toFixed(2)})`);
    });

    // Conexiones/POIs
    const conexData = p.Conexiones || p.conexiones || p.POIs || p.pois;
    const conexiones = {};
    if (conexData) {
      const entries = Array.isArray(conexData)
        ? conexData.map((v, i) => [`Conexion${i+1}`, v])
        : Object.entries(conexData);
      entries.forEach(([k, v]) => {
        const pt = extractVec3Point(v);
        if (pt) conexiones[k] = pt;
      });
    }
    console.log(`  Conexiones/POIs (${Object.keys(conexiones).length}):`);
    Object.entries(conexiones).forEach(([k, v]) => {
      console.log(`    "${k}": (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`);
    });
    console.log('');
  }

  // Probar rutas problemáticas
  const testDestinos = ['Sala A107', 'Sala A212', 'Sala A214', 'Sala A209', 'Sala A211'];
  console.log('\n=== PRUEBA DE RUTAS ===\n');
  for (const dest of testDestinos) {
    try {
      const res = await calcRuta.executeRutaHaciaDestino(dest, { edificio: 'A' });
      if (!res) {
        console.log(`[${dest}] → No encontrado`);
      } else {
        console.log(`[${dest}] → ${res.coordinates.length} puntos:`);
        res.coordinates.forEach((c, i) => console.log(`  [${i}] (${c[0].toFixed(2)}, ${c[1].toFixed(2)}, ${c[2].toFixed(2)})`));
      }
    } catch (e) {
      console.log(`[${dest}] → ERROR: ${e.message}`);
    }
    console.log('');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
