# InaGo - Backend Hexagonal + Frontend 3D

Este proyecto combina un backend Node.js/Express con una arquitectura hexagonal y un frontend Angular 17 que visualiza el mapa de INACAP en 2D/3D con BabylonJS. La idea principal es separar la lógica del negocio, la navegación y la gestión de espacios del acceso a datos y de la capa HTTP para mantener el sistema más testable, extensible y fácil de evolucionar.

## Visión general

- Backend: API REST orientada a servicios y casos de uso.
- Arquitectura: hexagonal (ports & adapters), con capas de dominio, aplicación, infraestructura y presentación.
- Datos: Firebase Firestore como origen principal de edificios, locaciones, rutas y grafos de navegación.
- Frontend: Angular + BabylonJS para renderizar edificios, pisos, rutas y puntos de interés en un mapa interactivo.

## Estructura del monorepo

```text
inaGo-_Apis_backEnd_V2/
├── src/
│   ├── app.js                              # Arranque Express y registro de rutas
│   ├── modules/
│   │   ├── api/
│   │   │   ├── infrastructure/
│   │   │   │   ├── controllers/
│   │   │   │   ├── middlewares/
│   │   │   │   └── routes/
│   │   │   └── presentation/
│   │   ├── gestion_espacios/
│   │   │   ├── application/
│   │   │   ├── domain/
│   │   │   └── infrastructure/
│   │   ├── sistema_navegacion/
│   │   │   ├── application/
│   │   │   ├── domain/
│   │   │   └── infrastructure/
│   │   ├── visualizacion_mapa/
│   │   │   ├── application/
│   │   │   ├── domain/
│   │   │   └── infrastructure/
│   │   └── shared/
│   │       ├── domain/
│   │       └── infrastructure/
│   └── ...
├── frontend/
│   ├── src/
│   ├── angular.json
│   ├── package.json
│   └── README.md
├── server.js
├── package.json
├── README.md
├── scratch/
└── .env
```

## Arquitectura hexagonal aplicada

La capa de dominio contiene las entidades y reglas de negocio fundamentales del sistema:

- modelos de edificios, locaciones, pisos
- value objects como `Point3D`, `Angle`, `Vector2D`
- errores del dominio como `ValidationError`, `NotFoundError`
- servicios de navegación y visualización

La capa de aplicación encapsula los casos de uso:

- `ListarEdificiosUseCase`
- `ObtenerEdificioPorIdUseCase`
- `BuscarLocacionUseCase`
- `CalcularRutaUseCase`
- `GenerarVisualizacionRutaUseCase`

Estos casos de uso actúan como la lógica de negocio que orquesta repositories, servicios y transformaciones, sin depender directamente de Express o Firebase.

La capa de infraestructura implementa los adapters:

- repositories Firestore
- mappers de documentos a modelos de dominio
- cache en memoria
- autenticación y configuración de Firebase
- middlewares HTTP, rutas y controladores

La capa de infraestructura expone puertos para que la aplicación pueda cambiar el origen de datos o la tecnología de persistencia sin afectar la lógica de negocio.

## Funciones principales del backend

### 1) Gestión de espacios
Responsable del catálogo de edificios y ubicaciones.

Incluye:

- listado de edificios
- consulta por ID o nombre
- listado de locaciones por edificio, piso o tipo
- búsqueda global de locaciones
- normalización de datos provenientes de Firestore

Esto se resuelve principalmente en la carpeta `src/modules/gestion_espacios`.

### 2) Sistema de navegación
Responsable de construir el grafo de navegación y resolver rutas internas.

Incluye:

- lectura de paths y nodos de navegación
- cálculo de rutas entre ubicaciones
- uso de algoritmo tipo A*
- validación y modelado de arcos, nodos, rutas y puntos 3D

Esto se resuelve en `src/modules/sistema_navegacion`.

### 3) Visualización del mapa
Genera la estructura necesaria para mostrar una ruta en el mapa:

- orientación de flechas
- suavizado de polilíneas
- transformación de coordenadas para visualización
- preparación de datos para renderizar trazas en mapas 2D/3D

Esto se resuelve en `src/modules/visualizacion_mapa`.

### 4) API REST
La capa HTTP está en `src/modules/api` y ofrece los endpoints para que el frontend consuma la información.

## Endpoints principales

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Verifica el estado del backend |
| GET | `/edificios` | Lista todos los edificios |
| GET | `/edificios/:id` | Obtiene un edificio por ID |
| GET | `/edificios/:id/locaciones` | Locaciones de un edificio |
| GET | `/edificios/:id/locaciones/piso/:piso` | Locaciones por piso |
| GET | `/edificios/:id/locaciones/tipo/:tipo` | Locaciones por tipo |
| GET | `/locaciones/tipo/:tipo` | Búsqueda global por tipo |
| GET | `/navegacion/ruta` | Calcula una ruta según parámetros |
| GET | `/ruta/:destino` | Compatibilidad con frontend legacy |
| GET | `/navigation-paths` | Devuelve todos los paths de navegación |
| GET | `/navigation-paths/piso/:piso` | Paths por piso |
| GET | `/rutas` | Rutas antiguas / compatibilidad |

## Backend en ejecución

El backend se inicia desde la raíz del proyecto:

```bash
npm install
npm run dev
```

También se puede lanzar directamente:

```bash
npm start
```

La API queda disponible en `http://localhost:3000` por defecto, a menos que se configure otra variable de entorno.

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto:

```env
PORT=3000
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_CLIENT_EMAIL=tu-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CORS_ORIGIN=http://localhost:4200
```

Estos valores se obtienen desde Firebase Admin SDK. La aplicación inicializa Firebase en `src/shared/infrastructure/firebase/firebaseAdmin.js` antes de levantar la API.

## Frontend

El frontend está en la carpeta `frontend` y se desarrolla con Angular 17. Su función es:

- consumir los endpoints del backend
- mostrar el plano de los edificios
- renderizar modelos 3D con BabylonJS
- navegar por pisos y edificios
- calcular y proyectar rutas internas
- mostrar marcadores, información de locaciones y paneles interactivos

### Estructura principal del frontend

```text
frontend/src/
├── app/
│   ├── core/
│   ├── map3d/
│   ├── services/
│   └── shared/
├── assets/
│   ├── 3d-models/
│   ├── icons/
│   └── images/
└── index.html
```

### Lógica destacada del frontend

- `map3d-container.component.ts`: orquesta la vista del mapa, selección de pisos y navegación general.
- `babylon-scene.service.ts`: carga modelos 3D, ajusta cámara, iluminación y renderizado de objetos.
- `map-navigation.service.ts`: gestiona mensajes, ubicaciones, selección y rutas.

### Ejecutar el frontend

```bash
cd frontend
npm install
npm start
```

El frontend se sirve normalmente en `http://localhost:4200`.

### Compilar el frontend

```bash
npm run build:frontend
```

O desde la raíz:

```bash
npm run build
```

## Stack tecnológico

| Tecnología | Uso principal |
| --- | --- |
| Node.js | Runtime del backend |
| Express | API REST |
| Firebase Admin | Conexión a Firestore |
| Angular 17 | Frontend SPA |
| BabylonJS | Render 3D del mapa |
| RxJS | Gestión reactiva del estado y eventos |

## Qué aporta esta arquitectura

- separación clara entre negocio e infraestructura
- casos de uso reutilizables
- menor acoplamiento entre API y Firebase
- facilidad para introducir nuevas fuentes de datos o visualizaciones
- mejor mantenimiento de navegación y modelos del campus

## Estado del proyecto

El sistema está orientado a ser una base de navegación y gestión espacial para INACAP, con un backend hexagonal bien segmentado y un frontend visual interactivo sobre modelos 3D. Es una solución monorepo preparada para crecer con más edificios, más rutas, más locaciones y más servicios de búsqueda.
