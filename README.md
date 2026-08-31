# Inamap — Backend Server

Servidor Express que actúa como intermediario entre el frontend Angular y Firebase Admin.

## Requisitos

- Node.js 18+
- Archivo `.env` con las credenciales de Firebase Admin (ver abajo)

## Cómo ejecutar

\`\`\`bash
cd BackEnd
npm install
npm run dev   # desarrollo (nodemon)
npm start     # producción
\`\`\`

El servidor corre en `http://localhost:3000` (o el puerto definido en `PORT`).

## Variables de entorno

Crear un archivo `.env` en `BackEnd/`:

\`\`\`
PORT=3000
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_CLIENT_EMAIL=tu-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CORS_ORIGIN=http://localhost:4200
\`\`\`

Estos valores salen del JSON de credenciales de Firebase Admin
(Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada).
`ServiceAccountKey.json` ya no es necesario una vez migrado a `.env` — puede eliminarse.

`CORS_ORIGIN` es opcional: si no se define, se permite cualquier origen (solo recomendable en desarrollo).

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servidor |
| GET | `/edificios` | Lista todos los edificios |
| GET | `/edificios/:id` | Edificio por ID |
| GET | `/edificios/nombre/:nombre` | Edificio por nombre |
| GET | `/edificios/:id/locaciones` | Locaciones de un edificio |
| GET | `/edificios/:id/locaciones/piso/:piso` | Locaciones por piso |
| GET | `/edificios/:id/locaciones/tipo/:tipo` | Locaciones por tipo |
| GET | `/edificios/:id/locaciones/nombre/:nombre` | Locación por nombre |
| GET | `/locaciones/:nombre` | Búsqueda global de locación |
| GET | `/navigation-paths` | Rutas de navegación |
| GET | `/navigation-paths/piso/:piso` | Rutas por piso |
| GET | `/rutas` | Colección antigua (no usada actualmente) |