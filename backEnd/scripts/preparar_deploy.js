#!/usr/bin/env node
/**
 * Arma backEnd/deploy/ con lo justo para subir la API al hosting
 * (cPanel → Setup Node.js App, https://api.inago.inacode.cl).
 *
 *   npm run deploy:preparar
 *
 * Copia server.js, package.json, package-lock.json y src/, y pone como .env
 * el archivo backEnd/.env.production (que NO se sube a git). No copia
 * node_modules: se instalan en el servidor con "Run NPM Install".
 *
 * La carpeta deploy/ está en .gitignore porque lleva credenciales.
 */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, 'deploy');
const envProduccion = path.join(raiz, '.env.production');

const ARCHIVOS = ['server.js', 'package.json', 'package-lock.json'];
const CARPETAS = ['src'];
const OBLIGATORIAS = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'ADMIN_TOKEN', 'CORS_ORIGIN'];

function fallar(mensaje) {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

// 1. Validar el .env de producción antes de copiar nada
if (!fs.existsSync(envProduccion)) {
  fallar('Falta backEnd/.env.production. Cópialo de backEnd/.env.example y complétalo con los datos de producción.');
}
const env = fs.readFileSync(envProduccion, 'utf8');
const valor = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim() || '';
const faltan = OBLIGATORIAS.filter((k) => !valor(k));
if (faltan.length) fallar(`En .env.production faltan: ${faltan.join(', ')}`);
if (valor('ADMIN_TOKEN').length < 24) fallar('ADMIN_TOKEN debe tener al menos 24 caracteres.');
if (/localhost|127\.0\.0\.1/.test(valor('CORS_ORIGIN'))) {
  console.warn('⚠ CORS_ORIGIN incluye localhost: quítalo cuando termines de probar.');
}
if (valor('TRUST_PROXY') !== 'true') {
  console.warn('⚠ TRUST_PROXY no es "true": en cPanel/LiteSpeed el límite por IP vería a todos como la misma IP.');
}

// 2. Carpeta limpia
fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });

// 3. Copiar código
for (const f of ARCHIVOS) fs.copyFileSync(path.join(raiz, f), path.join(destino, f));
for (const c of CARPETAS) fs.cpSync(path.join(raiz, c), path.join(destino, c), { recursive: true });

// 4. .env de producción (permisos 600: solo el dueño lo lee)
fs.copyFileSync(envProduccion, path.join(destino, '.env'));
fs.chmodSync(path.join(destino, '.env'), 0o600);

// 5. Instrucciones
fs.writeFileSync(path.join(destino, 'LEEME.txt'), `API InaGo — paquete para https://api.inago.inacode.cl
Generado: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}

1. FileZilla: activar "Servidor > Forzar mostrar archivos ocultos" (para ver .env).
2. Respaldar la carpeta actual de la app en el servidor (sobre todo su .env).
3. Subir TODO el contenido de esta carpeta a la carpeta de la app, sobrescribiendo.
   No subir ni borrar node_modules (en cPanel es un enlace que administra cPanel).
4. En el servidor, dejar .env con permisos 600.
5. cPanel > Setup Node.js App > editar la app:
   - Node.js version: 20 o superior (22 recomendado)
   - Application startup file: server.js
   - Run NPM Install, luego Restart.
6. Verificar:
   - https://api.inago.inacode.cl/health  ->  {"status":"ok"}
   - https://api.inago.inacode.cl/edificios  ->  lista de edificios
   - Un POST a /edificios sin clave  ->  401

Este archivo LEEME.txt no hace falta subirlo.
`);

// 6. Resumen
const contar = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? contar(path.join(dir, e.name)) : 1), 0);
console.log(`✓ Paquete listo en backEnd/deploy/ (${contar(destino)} archivos, incluye .env de producción).`);
console.log('  Siguiente paso: leer backEnd/deploy/LEEME.txt');
