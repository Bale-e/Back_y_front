#!/usr/bin/env node
/**
 * Compila el frontend y arma frontend/deploy/ listo para subir a
 * https://inago.inacode.cl (cPanel / LiteSpeed).
 *
 *   npm run deploy:preparar
 *
 * 1. Ejecuta el build de producción (ng build).
 * 2. Copia dist/inamap-angular/browser/ a deploy/, incluido el .htaccess
 *    (HTTPS, rutas de Angular, compresión, caché y Content-Security-Policy).
 * 3. Deja fuera modelos que el código no usa (no se descargan, solo ocupan espacio).
 * 4. Revisa que no se cuelen secretos ni source maps.
 *
 * La carpeta deploy/ está en .gitignore.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const raiz = path.join(__dirname, '..');
const build = path.join(raiz, 'dist', 'inamap-angular', 'browser');
const destino = path.join(raiz, 'deploy');

// Archivos del build que la app no carga (ver INACAPITO_MODEL_URL en inacapito-guide.service.ts)
const SIN_USO = [
  'assets/3d-models/Inacapito/inacapito_v7.glb',
  'assets/3d-models/Inacapito/inacapito_v7_walking.fbx',
  'assets/3d-models/Inacapito/inacapito_v7_walking.fbm',
];

function fallar(mensaje) {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

// 1. Build de producción (se llama al binario con node: en OneDrive los
//    archivos de node_modules/.bin pueden perder el permiso de ejecución)
console.log('Compilando el frontend (producción)…');
const ng = path.join(raiz, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
if (!fs.existsSync(ng)) fallar('Falta node_modules: ejecuta "npm ci" en frontend/ primero.');
try {
  execFileSync(process.execPath, [ng, 'build', '--configuration', 'production'], { cwd: raiz, stdio: 'inherit' });
} catch {
  fallar('El build falló; revisa los errores de arriba.');
}

// 2. Copiar a deploy/
if (!fs.existsSync(path.join(build, 'index.html'))) fallar(`No se encontró el build en ${build}`);
if (!fs.existsSync(path.join(build, '.htaccess'))) fallar('El build no trae .htaccess (revisa "assets" en angular.json).');
fs.rmSync(destino, { recursive: true, force: true });
fs.cpSync(build, destino, { recursive: true });

// 3. Quitar lo que no se usa
for (const rel of SIN_USO) fs.rmSync(path.join(destino, rel), { recursive: true, force: true });

// 4. Revisiones de seguridad
const archivos = [];
const recorrer = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) recorrer(p); else archivos.push(p);
  }
};
recorrer(destino);
const mapas = archivos.filter((f) => f.endsWith('.map'));
if (mapas.length) fallar(`Hay source maps en el paquete (exponen el código fuente): ${mapas.map((f) => path.relative(destino, f)).join(', ')}`);
const js = archivos.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const sospechosos = [/inago_sec_[0-9a-f]{20,}/, /-----BEGIN PRIVATE KEY-----/, /ADMIN_TOKEN\s*=\s*['"][^'"]{8,}/, /ADMIN_PASSWORD\s*=\s*['"][^'"]+/];
const hallado = sospechosos.find((re) => re.test(js));
if (hallado) fallar(`El JavaScript contiene algo que parece un secreto (${hallado}). No subir.`);

// 5. Instrucciones
fs.writeFileSync(path.join(destino, 'LEEME.txt'), `Frontend InaGo — paquete para https://inago.inacode.cl
Generado: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}

1. FileZilla: activar "Servidor > Forzar mostrar archivos ocultos" (para ver .htaccess).
2. Respaldar la carpeta actual de inago.inacode.cl en el servidor.
3. Borrar los main-*.js, polyfills-*.js y styles-*.css viejos de esa carpeta
   (cada build tiene nombres nuevos; los viejos solo ocupan espacio).
4. Subir TODO el contenido de esta carpeta, incluido .htaccess, sobrescribiendo.
5. Verificar en https://inago.inacode.cl:
   - carga la sede en 3D;
   - en la consola del navegador (F12) no hay errores de "Content Security Policy";
   - al buscar una sala de otro edificio, cambia de edificio y muestra las indicaciones;
   - recargar la página en una ruta interna no da 404.

La API que usa es https://api.inago.inacode.cl (ver src/app/core/config/api.config.ts).
Este archivo LEEME.txt no hace falta subirlo.
`);

const mb = archivos.reduce((t, f) => t + fs.statSync(f).size, 0) / 1048576;
console.log(`\n✓ Paquete listo en frontend/deploy/ (${archivos.length + 1} archivos, ${mb.toFixed(1)} MB, incluye .htaccess).`);
console.log('  Siguiente paso: leer frontend/deploy/LEEME.txt');
