# InaGo — Backend Express (Arquitectura Hexagonal)

> API REST desarrollada con **Node.js + Express 5** bajo los principios de **Arquitectura Hexagonal** (Ports & Adapters) y **Vertical Slicing**. Provee servicios de catálogo de edificios, locaciones, cálculo de rutas óptimas (algoritmo A*) y generación de datos geométricos de navegación 3D para el frontend.

---

## Tabla de contenidos

1. [Visión general](#visión-general)
2. [Estructura de directorios](#estructura-de-directorios)
3. [Módulos y arquitectura](#módulos-y-arquitectura)
4. [Variables de entorno](#variables-de-entorno)
5. [Instalación y ejecución](#instalación-y-ejecución)
6. [Pruebas y scripts](#pruebas-y-scripts)
7. [API REST — Resumen de endpoints](#api-rest--resumen-de-endpoints)

---

## Visión general

El backend de InaGo actúa como la fuente de verdad y el motor de cálculo del sistema de navegación indoor:
- **Base de datos:** Google Firebase Firestore (colecciones `edificios`, `locaciones`, `navigation-paths`).
- **Autenticación:** Validación de `Bearer Token` vía `authMiddleware`.
- **Caché en memoria:** `MemoryCacheAdapter` con TTL configurable para reducir lecturas a Firestore.
- **Servidor monolítico en producción:** Si el frontend está compilado en `frontend/dist/`, Express sirve automáticamente la SPA estática para rutas web fuera de la API.

---

## Estructura de directorios

```text
backEnd/
├── .env                              ← Variables de entorno locales
├── package.json                      ← Configuración y dependencias del backend
├── server.js                         ← Entry point: levanta Express en PORT
│
├── tests/                            ← Suites de pruebas de integración y endpoints
│   ├── test_auth_endpoints.js        ← Pruebas de autenticación y tokens
│   ├── test_crud_edificios.js        ← Pruebas de endpoints de edificios
│   └── test_hexagonal_endpoints.js   ← Suite principal de pruebas de arquitectura
│
├── scripts/                          ← Scripts administrativos y utilidades de Firestore
│   ├── crear_token_firestore.js      ← Registro de tokens en base de datos
│   ├── debug_paths.js                ← Depuración e inspección de grafos de navegación
│   └── ver_tokens.js                 ← Visualización de tokens existentes
│
└── src/
    ├── app.js                        ← Configuración de Express, middlewares y rutas
    │
    ├── modules/
    │   ├── api/                      ← Adaptador primario HTTP (sin lógica de negocio)
    │   │   ├── infrastructure/
    │   │   │   ├── controllers/      ← Edificios, Locaciones, Navegacion
    │   │   │   ├── middlewares/      ← authMiddleware, corsConfig, errorHandler, validateRequest
    │   │   │   └── routes/           ← edificios.routes, locaciones.routes, navegacion.routes
    │   │   └── presentation/
    │   │       └── view-models/      ← ApiResponse.js
    │   │
    │   ├── gestion_espacios/         ← Slice: catálogo de edificios y locaciones
    │   │   ├── application/          ← DTOs y casos de uso (Listar, Obtener, Crear, Actualizar, Eliminar, Buscar)
    │   │   ├── domain/               ← Entidades (Edificio, Locacion, Piso) y puertos (interfaces)
    │   │   └── infrastructure/       ← Repositorios Firestore, mappers y helpers
    │   │
    │   ├── sistema_navegacion/       ← Slice: grafos y cálculo de caminos
    │   │   ├── application/          ← DTOs y caso de uso CalcularRutaUseCase
    │   │   ├── domain/               ← Entidades (Graph, Node, Edge, Route), puertos y algoritmo A*
    │   │   └── infrastructure/       ← FirestoreNavigationRepository y mappers
    │   │
    │   └── visualizacion_mapa/       ← Slice: post-procesamiento visual de la ruta
    │       ├── application/          ← DTOs y GenerarVisualizacionRutaUseCase
    │       ├── domain/               ← ArrowOrientation, PathSegment, Waypoint, ArrowDirectionCalculator
    │       └── infrastructure/       ← MapCoordinatesTransformer
    │
    └── shared/                       ← Utilidades transversales
        ├── domain/                   ← Value objects (Point3D, Angle, Vector2D) y DomainErrors
        └── infrastructure/           ← DI Container, MemoryCacheAdapter y firebaseAdmin.js
```

---

## Módulos y arquitectura

### Capas del backend (Hexagonal)
1. **Dominio (`domain`):** Entidades y reglas de negocio puras (sin dependencias de frameworks ni librerías externas).
2. **Aplicación (`application`):** Casos de uso y DTOs de entrada y salida. Orquestan las operaciones llamando a los puertos del dominio.
3. **Infraestructura (`infrastructure`):** Implementación técnica de los puertos (Firebase Firestore, memoria caché, transformadores de coordenadas).
4. **Adaptador de Entrada (`api`):** Controladores Express y rutas HTTP que reciben las solicitudes del cliente y las delegan a los casos de uso.

---

## Variables de entorno

Configuradas en `backEnd/.env`:

```env
# Puerto del servidor
PORT=3000

# Tiempo de vida del caché en memoria (milisegundos)
CACHE_TTL_MS=600000

# Orígenes CORS permitidos (separados por coma)
CORS_ORIGIN=http://localhost:4200,https://tu-dominio.com

# Token secreto para validar peticiones Bearer
API_TOKEN=inago_sec_xxxxxxxxxxxxxxxxxxxx

# Credenciales de cuenta de servicio Firebase Admin SDK
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## Instalación y ejecución

### Instalar dependencias
```bash
cd backEnd
npm install
```

### Ejecutar en desarrollo (recarga automática con nodemon)
```bash
npm run dev
# Servidor disponible en http://localhost:3000
```

### Ejecutar en producción
```bash
npm start
```

---

## Pruebas y scripts

### Ejecutar tests de endpoints
```bash
npm run test:backend
```
Ejecuta `tests/test_hexagonal_endpoints.js`, levantando un servidor efímero en memoria y validando:
- Healthcheck (`/health`)
- Listado y búsqueda de edificios
- Filtro de locaciones por piso, tipo y cuerpo
- Cálculo de rutas enriquecidas (`/navegacion/ruta`)
- Compatibilidad con endpoints legacy

### Tests adicionales disponibles:
```bash
node tests/test_auth_endpoints.js   # Valida seguridad, tokens válidos y rechazos 401
node tests/test_crud_edificios.js   # Valida operaciones completas sobre edificios
```

### Scripts administrativos (`scripts/`):
```bash
node scripts/crear_token_firestore.js   # Genera un nuevo token de acceso
node scripts/ver_tokens.js              # Lista tokens en Firestore
node scripts/debug_paths.js             # Muestra la conectividad del grafo de navegación
```

---

## API REST — Resumen de endpoints

| Método | Ruta | Descripción | Requiere Token |
|---|---|---|:---:|
| `GET` | `/health` | Estado del servicio | No |
| `GET` | `/edificios` | Lista todos los edificios | Sí |
| `GET` | `/edificios/:id` | Detalle de edificio por ID | Sí |
| `GET` | `/edificios/:id/locaciones` | Locaciones del edificio | Sí |
| `GET` | `/edificios/:id/locaciones/piso/:piso` | Locaciones por piso en edificio | Sí |
| `GET` | `/edificios/:id/locaciones/tipo/:tipo` | Locaciones por tipo en edificio | Sí |
| `GET` | `/locaciones/tipo/:tipo` | Búsqueda global de locaciones por tipo | Sí |
| `GET` | `/locaciones/cuerpo/:cuerpo` | Búsqueda por identificador de sala/cuerpo | Sí |
| `GET` | `/navegacion/ruta?origen=...&destino=...` | Ruta óptima + waypoints + flechas 3D | Sí |
| `GET` | `/navigation-paths` | Grafos de navegación completos | Sí |
| `GET` | `/ruta/:destino` | Endpoint de retrocompatibilidad | Sí |
