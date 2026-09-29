# InaGo — Sistema de Navegación 3D para INACAP

> **Monorepo full-stack** que combina un backend Node.js/Express con arquitectura hexagonal y un frontend Angular que visualiza el campus de INACAP en 3D con BabylonJS. Permite a los usuarios buscar salas, calcular rutas y navegar por pisos y edificios de forma interactiva.

---

## Tabla de contenidos

1. [Visión general](#visión-general)
2. [Stack tecnológico](#stack-tecnológico)
3. [Estructura del monorepo](#estructura-del-monorepo)
4. [Arquitectura hexagonal (Backend)](#arquitectura-hexagonal-backend)
5. [Vertical Slicing](#vertical-slicing)
6. [Módulos del backend](#módulos-del-backend)
7. [API REST — Endpoints](#api-rest--endpoints)
8. [Seguridad — Autenticación por token](#seguridad--autenticación-por-token)
9. [Frontend Angular](#frontend-angular)
10. [Modelos 3D incluidos](#modelos-3d-incluidos)
11. [Variables de entorno](#variables-de-entorno)
12. [Guía de instalación y ejecución](#guía-de-instalación-y-ejecución)
13. [Despliegue con Docker](#despliegue-con-docker)
14. [Algoritmos y lógica clave](#algoritmos-y-lógica-clave)
15. [Beneficios de la arquitectura](#beneficios-de-la-arquitectura)
16. [Estado actual y roadmap](#estado-actual-y-roadmap)

---

## Visión general

InaGo es un sistema de **navegación indoor** pensado para el campus de INACAP. Su propósito es permitir que alumnos, docentes y visitantes encuentren fácilmente cualquier sala, laboratorio o espacio del campus usando un mapa interactivo en 3D.

El proyecto está dividido en dos capas principales:

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| **Backend** | Node.js + Express 5 | API REST, cálculo de rutas, acceso a Firestore |
| **Frontend** | Angular 17 + BabylonJS 7 | Visualización 3D, búsqueda de destinos, navegación por pisos |

La comunicación entre ambas capas se realiza mediante peticiones HTTP autenticadas con un token de portador (`Bearer Token`). El backend sirve además los archivos estáticos del frontend cuando este se compila, actuando como servidor monolítico para el despliegue en producción.

---

## Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| **Node.js** | ≥ 18 | Runtime del backend |
| **Express** | ^5.2.1 | Framework HTTP / API REST |
| **Firebase Admin SDK** | ^13.10.0 | Conexión y lectura de Firestore |
| **dotenv** | ^17.4.2 | Gestión de variables de entorno |
| **nodemon** | ^3.0.0 | Recarga automática en desarrollo |
| **Angular** | ^17.3.0 | Framework del frontend (SPA) |
| **BabylonJS** | ^7.0.0 | Motor de renderizado 3D WebGL |
| **babylonjs-loaders** | ^7.54.3 | Carga de modelos OBJ/MTL |
| **RxJS** | ~7.8.0 | Programación reactiva (Angular) |
| **TypeScript** | ~5.4.2 | Tipado estático en el frontend |
| **Nginx** | alpine | Servidor de producción del frontend (Docker) |

---

## Estructura del monorepo

```text
Back_y_front/                          ← Raíz del monorepo
├── .gitignore
├── README.md
│
├── backEnd/                           ← Aplicación backend (Node.js + Express)
│   ├── package.json                   ← Dependencias y scripts del backend
│   ├── server.js                      ← Entry point: carga .env e inicia Express en PORT
│   ├── .env                           ← Copia local de variables de entorno
│   └── src/
│       ├── app.js                     ← Configura Express, registra rutas y middlewares
│       ├── modules/
│       │   ├── api/                   ← Capa de adaptación HTTP
│       │   │   ├── infrastructure/
│       │   │   │   ├── controllers/
│       │   │   │   │   └── NavegacionController.js   ← Controlador de rutas y navegación
│       │   │   │   ├── middlewares/
│       │   │   │   │   ├── authMiddleware.js          ← Validación de Bearer Token
│       │   │   │   │   ├── corsConfig.js              ← Configuración CORS multi-origen
│       │   │   │   │   └── errorHandler.js            ← 404 y errores globales
│       │   │   │   └── routes/
│       │   │   │       ├── navegacion.routes.js       ← /navegacion/ruta
│       │   │   │       ├── edificios.routes.js        ← /edificios y sub-rutas
│       │   │   │       └── locaciones.routes.js       ← /locaciones y sub-rutas
│       │   │   └── presentation/
│       │   │       └── view-models/
│       │   │           └── ApiResponse.js             ← Estructura estándar de respuesta
│       │   │
│       │   ├── gestion_espacios/      ← Módulo de catálogo de edificios y locaciones
│       │   │   ├── application/
│       │   │   │   ├── dtos/          ← Data Transfer Objects de edificios/locaciones
│       │   │   │   └── use-cases/     ← Casos de uso: listar, buscar, filtrar
│       │   │   ├── domain/
│       │   │   │   ├── models/
│       │   │   │   │   ├── Edificio.js   ← Entidad: id, nombre, descripción, pisos, coordenadas
│       │   │   │   │   ├── Locacion.js   ← Entidad: nombre, tipo, piso, cuerpo, coordenadas3D
│       │   │   │   │   └── Piso.js       ← Entidad: número de piso
│       │   │   │   └── ports/
│       │   │   │       ├── IEdificioRepository.js    ← Interfaz del repositorio de edificios
│       │   │   │       └── ILocacionRepository.js    ← Interfaz del repositorio de locaciones
│       │   │   └── infrastructure/
│       │   │       ├── helpers/
│       │   │       │   └── firestoreHelpers.js       ← getFieldCI: acceso case-insensitive a campos
│       │   │       ├── mappers/
│       │   │       │   ├── EdificioDocumentMapper.js ← Firestore doc → Edificio
│       │   │       │   └── LocacionDocumentMapper.js ← Firestore doc → Locacion
│       │   │       └── repositories/
│       │   │           ├── FirestoreEdificioRepository.js  ← Implementación con Firestore
│       │   │           └── FirestoreLocacionRepository.js  ← Implementación con Firestore
│       │   │
│       │   ├── sistema_navegacion/    ← Módulo de grafos y cálculo de rutas
│       │   │   ├── application/
│       │   │   │   ├── dtos/
│       │   │   │   │   ├── CalcularRutaRequest.dto.js   ← DTO de entrada del caso de uso
│       │   │   │   │   └── RutaCalculadaResponse.dto.js ← DTO de salida: coordenadas, distancia
│       │   │   │   ├── ports/
│       │   │   │   │   └── ICalcularRutaUseCase.js      ← Interfaz del caso de uso
│       │   │   │   └── use-cases/
│       │   │   │       └── CalcularRutaUseCase.js       ← Lógica principal de navegación
│       │   │   ├── domain/
│       │   │   │   ├── models/
│       │   │   │   │   ├── Edge.js    ← Arista del grafo: fromNodeId, toNodeId, weight
│       │   │   │   │   ├── Graph.js   ← Grafo topológico: addNode, addEdge, getNeighbors
│       │   │   │   │   ├── Node.js    ← Nodo del grafo: id, point3d, metadata
│       │   │   │   │   └── Route.js   ← Ruta calculada: nodes, totalDistance
│       │   │   │   ├── ports/
│       │   │   │   │   └── INavigationRepository.js    ← Interfaz del repositorio de navegación
│       │   │   │   └── services/
│       │   │   │       └── AStarAlgorithm.js           ← Algoritmo A* para rutas óptimas
│       │   │   └── infrastructure/
│       │   │       ├── mappers/
│       │   │       │   └── NavigationPathDocumentMapper.js ← Firestore doc → Grafo de navegación
│       │   │       └── repositories/
│       │   │           └── FirestoreNavigationRepository.js ← Lectura de navigation-paths
│       │   │
│       │   ├── visualizacion_mapa/    ← Módulo de preparación de rutas para el frontend
│       │   │   ├── application/
│       │   │   │   ├── dtos/
│       │   │   │   │   └── VisualizacionRuta.dto.js     ← DTO con flechas y waypoints
│       │   │   │   └── use-cases/
│       │   │   │       └── GenerarVisualizacionRutaUseCase.js ← Genera polilínea y orientación
│       │   │   ├── domain/
│       │   │   │   ├── models/
│       │   │   │   │   ├── ArrowOrientation.js  ← Ángulo de cada flecha guía
│       │   │   │   │   ├── PathSegment.js        ← Segmento de ruta con metadatos
│       │   │   │   │   └── Waypoint.js           ← Punto de paso con coordenadas
│       │   │   │   └── services/
│       │   │   │       ├── ArrowDirectionCalculator.js ← Calcula orientación de flechas
│       │   │   │       └── PolylineSmoother.js         ← Suaviza polilíneas de ruta
│       │   │   └── infrastructure/
│       │   │       └── transformers/
│       │   │           └── MapCoordinateTransformer.js ← Transforma coordenadas para el mapa
│       │   │
│       │   └── shared/                ← Utilidades transversales a todos los módulos
│       │       ├── domain/
│       │       │   ├── errors/
│       │       │   │   ├── DomainError.js       ← Clase base de errores del dominio
│       │       │   │   ├── NotFoundError.js     ← Error 404 del dominio
│       │       │   │   └── ValidationError.js   ← Error de validación del dominio
│       │       │   └── value-objects/
│       │       │       ├── Angle.js     ← Value object: ángulo en radianes
│       │       │       ├── Point3D.js   ← Value object: punto 3D con método distanceTo()
│       │       │       └── Vector2D.js  ← Value object: vector 2D con operaciones básicas
│       │       └── infrastructure/
│       │           ├── cache/
│       │           │   └── MemoryCacheAdapter.js  ← Caché en memoria con TTL configurable
│       │           └── firebase/
│       │               └── firebaseAdmin.js        ← Inicialización de Firebase Admin SDK
│
└── frontend/                          ← Aplicación frontend (Angular 17)
    ├── package.json                   ← Dependencias y scripts del frontend
    ├── angular.json                   ← Configuración del proyecto Angular
    ├── tsconfig.json / tsconfig.app.json
    ├── Dockerfile                     ← Build multi-etapa: Angular → Nginx
    ├── nginx.conf                     ← Configuración de Nginx para SPA
    ├── .env.example                   ← Plantilla de variables de entorno del frontend
    └── src/
        ├── index.html                 ← Punto de entrada HTML
        ├── main.ts                    ← Bootstrap de Angular
        ├── polyfills.ts               ← Compatibilidad de navegadores
        └── app/
            ├── app.module.ts          ← Módulo raíz de Angular
            ├── app.component.ts       ← Componente raíz
            ├── app.component.html     ← Template raíz
            ├── app.component.scss     ← Estilos raíz
            ├── core/
            │   ├── config/
            │   │   └── api.config.ts          ← URL base de la API
            │   └── models/
            │       ├── building.model.ts       ← Tipo Building del frontend
            │       ├── edificio.model.ts       ← Interfaz Edificio (espejo del backend)
            │       ├── floor.model.ts          ← Interfaz Floor
            │       ├── locacion.model.ts       ← Interfaz Locacion con Coordenadas3D
            │       ├── navegacion.model.ts     ← BuildingId ('A'|'B'|'C'|'S'), SelectedLocationInfo
            │       └── navigation.model.ts     ← Modelo de respuesta de navegación
            ├── map3d/
            │   ├── map3d.module.ts             ← Módulo de mapa 3D (lazy o eager)
            │   ├── components/
            │   │   ├── map3d-container.component.ts    ← Componente orquestador principal
            │   │   ├── map3d-container.component.html  ← Template del visor 3D
            │   │   ├── map3d-container.component.scss  ← Estilos del visor
            │   │   ├── floor-selector/                 ← Selector de piso (diálogo)
            │   │   ├── location-detail-panel/          ← Panel lateral de información de sala
            │   │   ├── map-controls/                   ← Botones de zoom, reset, vista 2D/3D
            │   │   └── map-search/                     ← Barra de búsqueda con autocompletado
            │   └── services/
            │       ├── babylon-scene.service.ts        ← Motor 3D: cámara, modelos, rutas, marcadores
            │       ├── guide-arrow.service.ts          ← Dibuja flechas 3D animadas de ruta
            │       └── map-navigation.service.ts       ← Estado reactivo: edificio, piso, destino
            ├── services/
            │   ├── espacios-api.service.ts             ← HTTP: edificios y locaciones
            │   └── navegacion-api.service.ts           ← HTTP: cálculo de rutas enriquecidas
            └── shared/
                └── shared.module.ts                    ← Módulo de utilidades compartidas
        └── assets/
            ├── 3d-models/
            │   ├── Edificio A/       ← Piso 1, 2, 3 en formato OBJ + MTL
            │   ├── Edificio B/       ← Piso 1, 2, 3 en formato OBJ + MTL
            │   ├── Edificio C/       ← Piso 1 en formato OBJ + MTL
            │   └── sede/             ← Modelo completo del campus (INSTITUTO EN 3D.obj)
            ├── icons/                ← Iconos de la interfaz
            ├── images/               ← Imágenes de la interfaz
            ├── js/
            │   └── cuerpo23-browser-overlay.js  ← Script de overlay de sala específica
            └── styles/
                ├── _mixins.scss      ← Mixins SCSS reutilizables
                ├── _variables.scss   ← Variables de colores, fuentes y tamaños
                └── styles.scss       ← Estilos globales de la aplicación
```

---

## Arquitectura hexagonal (Backend)

El backend implementa la **arquitectura hexagonal** (también llamada Ports & Adapters), lo que significa que la lógica de negocio está completamente aislada de los detalles técnicos como Express, Firebase o cualquier otro framework.

```
┌─────────────────────────────────────────────────────────────┐
│                        ADAPTADORES                          │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │   HTTP/REST  │   │   Firestore  │   │  Caché Memoria │  │
│  │ (Express +   │   │  (Firebase   │   │ (MemoryCache   │  │
│  │  Controllers)│   │   Admin SDK) │   │  Adapter)      │  │
│  └──────┬───────┘   └──────┬───────┘   └───────┬────────┘  │
│         │                  │                    │           │
│  ┌──────▼──────────────────▼────────────────────▼────────┐  │
│  │                      PUERTOS                          │  │
│  │  IEdificioRepository │ ILocacionRepository │ INavRepo  │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │                  CASOS DE USO                         │  │
│  │  ListarEdificios │ BuscarLocacion │ CalcularRuta      │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │                    DOMINIO                            │  │
│  │  Edificio │ Locacion │ Graph │ Node │ Edge │ Route    │  │
│  │  AStarAlgorithm │ Point3D │ Angle │ Vector2D         │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Capas de la arquitectura

#### 1. Capa de Dominio
Contiene las entidades y reglas de negocio puras, **sin dependencias externas**.

- **Entidades**: `Edificio`, `Locacion`, `Piso`, `Node`, `Edge`, `Graph`, `Route`
- **Value Objects**: `Point3D` (punto 3D con `distanceTo()`), `Angle`, `Vector2D`
- **Errores de dominio**: `DomainError`, `NotFoundError`, `ValidationError`
- **Servicios de dominio**: `AStarAlgorithm`, `ArrowDirectionCalculator`, `PolylineSmoother`

#### 2. Capa de Aplicación
Orquesta los casos de uso usando las interfaces (puertos) del dominio.

- `CalcularRutaUseCase` — calcula rutas entre puntos del campus
- `GenerarVisualizacionRutaUseCase` — prepara flechas y waypoints para el frontend
- DTOs de entrada/salida para cada caso de uso

#### 3. Capa de Infraestructura
Implementa los puertos del dominio con tecnologías concretas.

- **Repositorios Firestore**: `FirestoreEdificioRepository`, `FirestoreLocacionRepository`, `FirestoreNavigationRepository`
- **Mappers**: transforman documentos Firestore en entidades del dominio
- **Cache**: `MemoryCacheAdapter` con TTL (por defecto 10 minutos, configurable con `CACHE_TTL_MS`)
- **Firebase**: inicialización del Admin SDK en `firebaseAdmin.js`

#### 4. Capa de Presentación (API)
Adaptadores de entrada HTTP.

- **Controladores**: reciben peticiones HTTP y las delegan a los casos de uso
- **Rutas**: definen los endpoints REST
- **Middlewares**: CORS, autenticación por token, manejo de errores
- **View Models**: estructuran la respuesta para el cliente

---

## Vertical Slicing

Además de la arquitectura hexagonal por capas horizontales (dominio → aplicación → infraestructura), el backend está organizado en **cuatro slices verticales**: cada uno agrupa todo lo necesario para una funcionalidad completa, desde la ruta HTTP hasta la base de datos, sin que un slice tenga que tocar el código interno de otro.

### ¿Qué es un vertical slice?

Un **slice vertical** corta el sistema de arriba abajo: en lugar de tener una capa de "todos los controladores" y una capa de "todos los repositorios", cada funcionalidad lleva consigo su propio controlador, caso de uso, entidades y repositorio. Esto hace que cada slice sea independiente y modificable sin afectar a los demás.

```
               HTTP Request
                    │
   ┌────────────────┼──────────────────┐
   │                │                  │
   ▼                ▼                  ▼
┌──────────┐  ┌──────────┐  ┌─────────────────┐
│  SLICE   │  │  SLICE   │  │     SLICE       │
│    1     │  │    2     │  │       3         │
│ Gestión  │  │Navegación│  │  Visualización  │
│  de      │  │ y Rutas  │  │   del Mapa      │
│ Espacios │  │          │  │                 │
└──────────┘  └──────────┘  └─────────────────┘
      │             │               │
      └─────────── API ─────────────┘
         (rutas, controladores,
         middlewares, view-models)
      │             │               │
      └──────── Shared ─────────────┘
        (errores, value objects,
         Firebase, caché)
```

> **Nota sobre el slice API:** a diferencia de los otros tres, el slice `api` **no tiene capa de dominio ni de aplicación**, porque no contiene lógica de negocio. Solo tiene dos capas: `infrastructure/` (controladores, rutas, middlewares) y `presentation/` (view-models). Actúa como el punto de entrada HTTP que delega en los casos de uso de los otros slices.

---

### Slice 1 — Gestión de Espacios (`gestion_espacios`)

Responde a la pregunta: **¿qué espacios existen en el campus?**

| Capa | Archivo(s) |
|---|---|
| **Rutas HTTP** | `edificios.routes.js`, `locaciones.routes.js` |
| **Controladores** | `EdificiosController.js`, `LocacionesController.js` |
| **Casos de uso** | `ListarEdificiosUseCase` — `execute()`, `executeById()`, `executeByNombre()` |
| | `BuscarLocacionUseCase` — `executePorEdificio()`, `executePorPiso()`, `executePorTipo()`, `executeGlobal()`, `executeGlobalPorCuerpo()` |
| | `ObtenerEdificioUseCase` |
| **DTOs** | `EdificioResponse.dto.js`, `LocacionResponse.dto.js` |
| **Entidades** | `Edificio`, `Locacion`, `Piso` |
| **Puertos** | `IEdificioRepository`, `ILocacionRepository` |
| **Repositorios** | `FirestoreEdificioRepository`, `FirestoreLocacionRepository` |
| **Mappers** | `EdificioDocumentMapper`, `LocacionDocumentMapper` |
| **Frontend** | `EspaciosApiService`, modelos `Edificio`, `Locacion`, `Floor` |

**Endpoints que sirve:**
```
GET /edificios
GET /edificios/nombre/:nombre
GET /edificios/:id
GET /edificios/:id/locaciones
GET /edificios/:id/locaciones/piso/:piso
GET /edificios/:id/locaciones/tipo/:tipo
GET /edificios/:id/locaciones/nombre/:nombre
GET /locaciones/piso/:piso
GET /locaciones/tipo/:tipo
GET /locaciones/cuerpo/:cuerpo
GET /locaciones/:nombre
```

---

### Slice 2 — Sistema de Navegación (`sistema_navegacion`)

Responde a la pregunta: **¿cómo llego de un punto A a un punto B?**

| Capa | Archivo(s) |
|---|---|
| **Rutas HTTP** | `navegacion.routes.js` |
| **Controlador** | `NavegacionController.js` — `calcularRuta()`, `obtenerRutaHaciaDestino()` |
| **Caso de uso** | `CalcularRutaUseCase` — `execute()`, `executeRutaHaciaDestino()` |
| **DTOs** | `CalcularRutaRequest.dto.js`, `RutaCalculadaResponse.dto.js` |
| **Puerto de aplicación** | `ICalcularRutaUseCase` |
| **Entidades** | `Graph`, `Node`, `Edge`, `Route` |
| **Puerto de dominio** | `INavigationRepository` |
| **Servicio de dominio** | `AStarAlgorithm` — heurística euclidiana 3D |
| **Repositorio** | `FirestoreNavigationRepository` — lee `navigation-paths` |
| **Mapper** | `NavigationPathDocumentMapper` — Firestore doc → grafo |
| **Frontend** | `NavegacionApiService`, `MapNavigationService.calculateRoute()` |

**Endpoints que sirve:**
```
GET /navegacion/ruta?destino=...&origen=...&piso=...&edificio=...
GET /navegacion/ruta/:destino
GET /ruta/:destino           (retrocompatibilidad)
GET /navigation-paths
GET /navigation-paths/piso/:piso
GET /rutas
```

---

### Slice 3 — Visualización del Mapa (`visualizacion_mapa`)

Responde a la pregunta: **¿cómo se muestra la ruta al usuario en el mapa 3D?**

Este slice no tiene endpoints propios: es invocado **internamente por el Slice 2** para enriquecer la respuesta con datos visuales antes de enviarla al frontend.

| Capa | Archivo(s) |
|---|---|
| **Invocación** | `NavegacionController.calcularRuta()` llama a este slice tras calcular la ruta |
| **Caso de uso** | `GenerarVisualizacionRutaUseCase.execute(coordinates, options)` |
| **DTO** | `VisualizacionRuta.dto.js` — waypoints, segmentos, orientaciones de flechas |
| **Entidades** | `ArrowOrientation`, `PathSegment`, `Waypoint` |
| **Servicios de dominio** | `ArrowDirectionCalculator` — calcula el ángulo de cada flecha |
| | `PolylineSmoother` — suaviza la polilínea de la ruta |
| **Transformer** | `MapCoordinateTransformer` — adapta coordenadas al sistema del mapa |
| **Frontend** | `BabylonSceneService.drawAnimatedRoute()`, `GuideArrowService` |

---

### Shared — Código transversal

No es un slice de funcionalidad sino una capa de **utilidades compartidas** que los tres slices consumen sin duplicar código:

| Pieza | Usada por |
|---|---|
| `Point3D`, `Angle`, `Vector2D` | Slices 2 y 3 (geometría de rutas y flechas) |
| `DomainError`, `NotFoundError`, `ValidationError` | Los tres slices |
| `MemoryCacheAdapter` | Repositorios de los slices 1 y 2 |
| `firebaseAdmin.js` | Repositorios de los tres slices |

---

### Slice API — Adaptador HTTP (`api`)

Responde a la pregunta: **¿cómo entra una petición HTTP al sistema y cómo sale la respuesta?**

Este slice **no tiene lógica de negocio propia**. Actúa como intermediario entre el mundo exterior (HTTP) y los casos de uso de los otros tres slices. A diferencia del resto, solo tiene dos capas:

#### Capa `infrastructure/`

| Subcarpeta | Archivo | Responsabilidad |
|---|---|---|
| `routes/` | `edificios.routes.js` | Define las URLs del slice de espacios y las asocia a controladores |
| | `locaciones.routes.js` | URLs de búsqueda global de locaciones |
| | `navegacion.routes.js` | URLs de cálculo de rutas |
| `controllers/` | `EdificiosController.js` | Extrae parámetros del `req`, invoca `ListarEdificiosUseCase` o `BuscarLocacionUseCase`, envía `res` |
| | `LocacionesController.js` | Igual para búsquedas globales de locaciones |
| | `NavegacionController.js` | Igual para navegación; encadena además `GenerarVisualizacionRutaUseCase` |
| `middlewares/` | `authMiddleware.js` | Extrae y valida el Bearer Token contra `API_TOKEN` del `.env`. Devuelve 401 si falla |
| | `corsConfig.js` | Lee `CORS_ORIGIN` del `.env` y configura qué orígenes pueden hacer peticiones |
| | `errorHandler.js` | Captura errores no manejados; mapea `DomainError` → 4xx, genéricos → 500 |
| | `validateRequest.js` | Valida la forma de los parámetros de entrada antes de llegar al controlador |

#### Capa `presentation/`

| Archivo | Responsabilidad |
|---|---|
| `view-models/ApiResponse.js` | Estructura estándar de respuesta: `{ data, error, status }` |

**Flujo interno del slice API para cada petición:**

```
Petición HTTP
      ↓
   routes         ← ¿qué URL existe y qué controlador la atiende?
   middlewares    ← ¿el origen está permitido? ¿el token es válido? ¿los parámetros son correctos?
   controllers    ← delega en el caso de uso del slice correspondiente
   view-models    ← formatea el resultado antes de enviarlo
      ↓
Respuesta HTTP
```

---

### Flujo completo de una petición de ruta

```
Frontend
  │  GET /navegacion/ruta?destino=Sala A201
  ▼
[Slice API — infrastructure]
  corsConfig      → origen http://localhost:4200 permitido ✓
  authMiddleware  → Bearer Token válido ✓
  validateRequest → parámetros correctos ✓
  NavegacionController.calcularRuta()
  │
  ├─► [Slice 2 — sistema_navegacion]
  │     CalcularRutaUseCase
  │       ├── FirestoreNavigationRepository  (lee navigation-paths de Firestore)
  │       ├── FirestoreLocacionRepository    (fallback si no hay path)
  │       └── findTurnPointOnPath()          (punto de inflexión exacto a 90°)
  │
  └─► [Slice 3 — visualizacion_mapa]
        GenerarVisualizacionRutaUseCase
          ├── ArrowDirectionCalculator  (ángulo de cada flecha)
          ├── PolylineSmoother          (polilínea suavizada)
          └── MapCoordinateTransformer  (coordenadas al sistema BabylonJS)

[Slice API — presentation]
  ApiResponse → res.json({ coordinates, distance, visualizacion })
  │
  ▼
Frontend: MapNavigationService → BabylonSceneService.drawAnimatedRoute()
```

---

## Módulos del backend

### `gestion_espacios` — Catálogo de edificios y locaciones

Gestiona el inventario de espacios físicos del campus.

**Responsabilidades:**
- Listar todos los edificios registrados en Firestore
- Obtener un edificio por su ID o nombre
- Listar locaciones filtrando por edificio, piso o tipo
- Búsqueda global de locaciones por nombre, tipo o número de cuerpo
- Normalización de datos provenientes de Firestore (campos con variantes de mayúsculas/minúsculas gestionados con `getFieldCI`)
- Caché de todas las locaciones bajo la clave `locaciones:todas_globales` para evitar lecturas repetidas a Firestore

**Entidades clave:**
- `Edificio`: `{ id, nombre, descripcion, pisos[], coordenadas, raw }`
- `Locacion`: `{ id, nombre, tipo, piso, cuerpo, coordenadas, edificioId, edificioNombre, raw }`
- `Piso`: número de piso como concepto del dominio

---

### `sistema_navegacion` — Cálculo de rutas

Construye el grafo de navegación desde Firestore y resuelve rutas óptimas.

**Responsabilidades:**
- Leer `navigation-paths` desde Firestore (documentos con Accesos, Giros, Conexiones y POIs)
- Construir un grafo topológico de nodos y aristas
- Calcular la ruta óptima entre dos puntos usando el **algoritmo A\***
- Calcular el punto exacto de inflexión en 90° sobre el pasillo para cada sala

**Algoritmo de rutas (`CalcularRutaUseCase`):**

1. Busca el destino en los `navigation-paths` (Conexiones y Accesos)
2. Si no lo encuentra, busca en la colección de Locaciones de Firestore (fallback)
3. Determina el piso/edificio objetivo y filtra el navigation-path correspondiente
4. Calcula el `turnPoint`: proyección perpendicular del destino sobre el pasillo — garantiza el giro exacto en 90°
5. Construye la ruta: `[inicio] → [giros del pasillo previos al turnPoint] → [turnPoint] → [destino]`
6. Limpia puntos duplicados y calcula la distancia total

**Algoritmo A\* (`AStarAlgorithm.js`):**
- Heurística: distancia euclidiana 3D entre nodos (`Point3D.distanceTo()`)
- Opera sobre el grafo topológico multi-piso
- Devuelve una instancia de `Route` con los nodos del camino y la distancia total

---

### `visualizacion_mapa` — Preparación visual de rutas

Transforma las coordenadas brutas de la ruta en datos listos para renderizar. No tiene endpoints propios: es invocado internamente por `NavegacionController` tras recibir la ruta calculada.

**Responsabilidades:**
- Clasificar cada punto de la ruta como `start`, `intermediate` o `end` → genera `Waypoint[]`
- Calcular la orientación de cada flecha guía (`ArrowDirectionCalculator`)
- Suavizar la polilínea de la ruta (`PolylineSmoother`)
- Transformar coordenadas para el sistema de referencia del mapa (`MapCoordinateTransformer`)
- Generar el DTO de visualización con waypoints, flechas y polilínea suavizada

---

### `api` — Adaptador HTTP

Punto de entrada de todas las peticiones HTTP. No contiene lógica de negocio: delega en los casos de uso de los otros tres módulos.

**Capas que tiene (solo dos, sin dominio ni aplicación):**

- **`infrastructure/`**: controladores, rutas y middlewares
  - `EdificiosController`, `LocacionesController`, `NavegacionController`
  - `edificios.routes.js`, `locaciones.routes.js`, `navegacion.routes.js`
  - `authMiddleware` — valida el Bearer Token
  - `corsConfig` — configura los orígenes permitidos
  - `errorHandler` — convierte errores en respuestas HTTP apropiadas
  - `validateRequest` — valida parámetros de entrada antes de llegar al controlador

- **`presentation/`**: estructura la respuesta
  - `ApiResponse` — formato estándar `{ data, error, status }`

---

### `shared` — Utilidades transversales

Piezas reutilizables por todos los módulos:

| Pieza | Capa | Descripción |
|---|---|---|
| `Point3D` | Dominio | Punto 3D **inmutable** (`Object.freeze`) con `distanceTo()` y fábrica `Point3D.create()` |
| `Angle` | Dominio | Ángulo en radianes con utilidades de conversión |
| `Vector2D` | Dominio | Vector 2D para operaciones geométricas planas |
| `DomainError` | Dominio | Clase base de errores del dominio |
| `NotFoundError` | Dominio | Recurso no encontrado (mapea a HTTP 404) |
| `ValidationError` | Dominio | Error de validación de datos de entrada (mapea a HTTP 400) |
| `MemoryCacheAdapter` | Infraestructura | Caché en memoria con TTL. API: `get()`, `set()`, `withCache(key, fn)` |
| `firebaseAdmin.js` | Infraestructura | Inicialización única del Firebase Admin SDK; exporta `{ admin, db }` |

---

## API REST — Endpoints

> **Nota:** Todos los endpoints (excepto `/health`) requieren el header `Authorization: Bearer <API_TOKEN>`.

### Healthcheck
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Verifica que el servidor está en línea. **Público (sin token).** |

### Edificios
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/edificios` | Lista todos los edificios registrados |
| `GET` | `/edificios/:id` | Obtiene un edificio por su ID de Firestore |
| `GET` | `/edificios/:id/locaciones` | Lista todas las locaciones de un edificio |
| `GET` | `/edificios/:id/locaciones/piso/:piso` | Locaciones de un edificio filtradas por piso |
| `GET` | `/edificios/:id/locaciones/tipo/:tipo` | Locaciones de un edificio filtradas por tipo |

### Locaciones
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/locaciones/tipo/:tipo` | Búsqueda global de locaciones por tipo en todos los edificios |

### Navegación
| Método | Ruta | Parámetros | Descripción |
|---|---|---|---|
| `GET` | `/navegacion/ruta` | `?destino=...&origen=...&piso=...&edificio=...` | Calcula la ruta óptima y devuelve coordenadas + visualización |
| `GET` | `/navegacion/ruta/:destino` | `?origen=...&edificio=...&piso=...` | Alias del endpoint anterior con destino en la URL |
| `GET` | `/ruta/:destino` | `?origen=...` | Endpoint de retrocompatibilidad con el frontend Angular |

### Navigation Paths
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/navigation-paths` | Devuelve todos los documentos de rutas de navegación de Firestore |
| `GET` | `/navigation-paths/piso/:piso` | Devuelve el navigation-path de un piso específico |
| `GET` | `/rutas` | Colección antigua de rutas (retrocompatibilidad) |

### Respuesta típica de `/navegacion/ruta`

```json
{
  "startName": "MainEntrance",
  "endName": "Sala A201",
  "startPathId": "EdificioA-Piso2",
  "endPathId": "EdificioA-Piso2",
  "coordinates": [
    [0.5, 0.05, -1.2],
    [3.4, 0.05, -1.2],
    [3.4, 0.05, -4.7],
    [5.1, 0.05, -4.7]
  ],
  "distance": 8.73,
  "visualizacion": {
    "waypoints": [...],
    "segments": [...],
    "arrowOrientations": [...]
  }
}
```

---

## Seguridad — Autenticación por token

Todos los endpoints protegidos validan el token mediante el middleware `authMiddleware`:

```http
GET /edificios HTTP/1.1
Authorization: Bearer <API_TOKEN>
```

El middleware extrae el token del header `Authorization` (formato `Bearer <token>` o token directo), lo compara con la variable de entorno `API_TOKEN` y responde con `401` si no coincide o `500` si `API_TOKEN` no está configurada.

El token **nunca se almacena en Firestore**, lo que mantiene la base de datos limpia y el sistema de autenticación simple de gestionar.

---

## Frontend Angular

### Componentes principales

#### `Map3dContainerComponent`
El componente orquestador principal del visor 3D. Coordina:
- Inicialización y ciclo de vida de la escena BabylonJS
- Selección de edificio y piso con transiciones animadas
- Búsqueda y selección de destinos
- Dibujo de rutas animadas y marcadores en pantalla
- Panel de información de locación al hacer clic en una sala
- Tarjetas de navegación paso a paso (indicaciones de giro)
- Navegación multi-piso secuencial

Contiene la lógica de los modelos de piso disponibles:

| Edificio | Pisos | Archivo OBJ |
|---|---|---|
| A | Piso 1 | `Edifico A - Piso 1.obj` |
| A | Piso 2 | `Edificio A - piso 2.obj` |
| A | Piso 3 | `Edificio A - piso 3.obj` |
| B | Piso 1 | `Edificio B - Piso 1.obj` |
| B | Piso 2 | `Edificio B - Piso 2.obj` |
| B | Piso 3 | `Edificio B - Piso 3.obj` |
| C | Piso 1 | `Edificio C - Piso 1.obj` |
| Sede | — | `INSTITUTO EN 3D.obj` |

---

#### `BabylonSceneService`
Servicio Angular que encapsula toda la interacción con el motor BabylonJS. Responsable de:

- **Inicializar la escena**: crea el canvas, el engine, la cámara `ArcRotateCamera`, luces hemisférica y direccional, y un skybox oscuro
- **Cargar modelos OBJ**: carga archivos `.obj` + `.mtl` desde `/assets/3d-models/`, los centra automáticamente usando bounding boxes y aplica materiales con propiedades de reflejo controladas
- **Transición entre pisos**: animación fluida de 2200ms en 3 etapas (acercamiento, proximidad, alejamiento/desvanecimiento) al cambiar de piso
- **Auto-rotación**: rotación lenta de presentación del modelo de Sede con efecto de "respiración" (zoom suave oscilante)
- **Marcadores proyectados**: proyecta puntos 3D a coordenadas de pantalla usando raycast al suelo, permitiendo mostrar botones HTML sobre objetos 3D (ej. "Ir al Edificio B")
- **Rutas animadas**: dibuja flechas guía en 3D una a una con animación secuencial (1100ms por segmento)
- **Punto de codo en L**: si la ruta tiene solo 2 puntos, calcula automáticamente un punto de inflexión a 90° para que las flechas no atraviesen paredes en diagonal
- **Focus en sala**: anima la cámara hacia una sala específica al hacer clic, con lógica de orientación diferente según el edificio y piso

---

#### `MapNavigationService`
Servicio de estado reactivo (RxJS `BehaviorSubject`) que mantiene:

| Observable | Tipo | Descripción |
|---|---|---|
| `currentBuilding$` | `BuildingId` | Edificio actualmente visible ('A', 'B', 'C', 'S') |
| `currentFloor$` | `string` | Nombre del modelo .obj del piso actual |
| `selectedLocation$` | `SelectedLocationInfo \| null` | Sala seleccionada con nombre, tipo, edificio y piso |
| `destinations$` | `string[]` | Lista de nombres de destinos disponibles |

Métodos clave:
- `loadDestinations()`: carga todas las locaciones y extrae nombres únicos para el buscador
- `calculateRoute(name)`: obtiene la ruta desde el backend, resuelve el edificio/piso destino y devuelve los puntos de ruta en coordenadas BabylonJS
- `getLocationInfoByMeshNameAsync(meshName)`: resuelve información de sala a partir del nombre del mesh (ej. `cuerpo15`), cruzando con Firestore
- `findNearestLocationByCoords(point)`: encuentra la locación más cercana a un punto 3D por distancia euclidiana
- `extractVec3(obj)`: extrae coordenadas 3D de cualquier objeto Firestore con variantes de campos (`Coordenadas3D`, `Coordenadas`, `coordenadas`, etc.)

---

#### `MapSearchComponent`
Barra de búsqueda con autocompletado:
- Filtra destinos en tiempo real por nombre (hasta 8 sugerencias)
- Emite `destinationSelected` al seleccionar un destino
- Emite `searchCleared` al limpiar la búsqueda
- Cierra el panel de sugerencias con un delay de 200ms al perder el foco (permite hacer clic en las sugerencias)

---

#### `GuideArrowService`
Función `dibujarFlechaGuia()` que genera meshes 3D de flechas (cilindro + cono) para marcar cada segmento de la ruta en la escena BabylonJS.

---

### Servicios HTTP del frontend

#### `EspaciosApiService`
- `getEdificios()`: lista todos los edificios
- `getEdificio(id)`: obtiene un edificio por ID
- `getLocacionesPorEdificio(id)`: locaciones de un edificio
- `getLocacionesDeTodosLosEdificios()`: agrega locaciones de todos los edificios en una sola lista
- `buscarLocaciones(query)`: búsqueda por nombre

#### `NavegacionApiService`
- `getRuta(destino, options)`: calcula la ruta hacia un destino
- `getRutaEnriquecida(destino, options)`: ruta + datos de visualización

Ambos servicios incluyen el `Bearer Token` en cada petición HTTP.

---

## Modelos 3D incluidos

Los modelos se distribuyen en formato OBJ + MTL y están organizados por edificio:

```
assets/3d-models/
├── Edificio A/
│   ├── Edifico A - Piso 1.obj / .mtl
│   ├── Edificio A - piso 2.obj / .mtl
│   └── Edificio A - piso 3.obj / .mtl
├── Edificio B/
│   ├── Edificio B - Piso 1.obj / .mtl
│   ├── Edificio B - Piso 2.obj / .mtl
│   └── Edificio B - Piso 3.obj / .mtl
├── Edificio C/
│   └── Edificio C - Piso 1.obj / .mtl
└── sede/
    └── INSTITUTO EN 3D.obj / .mtl   ← Vista panorámica del campus completo
```

Cada modelo de piso está nombrado con mallas tipo `cuerpoN`, donde `N` corresponde al número de sala registrado en Firestore en el campo `Cuerpo`. Esto permite que al hacer clic en un mesh se resuelva automáticamente la información de la sala consultando Firestore.

---

## Variables de entorno

### Backend (`backEnd/.env`)

```env
# Puerto del servidor Express
PORT=3000

# TTL del caché en memoria (milisegundos, por defecto 10 minutos)
CACHE_TTL_MS=600000

# Credenciales de Firebase Admin SDK
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@tu-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Orígenes permitidos para CORS (separados por coma)
CORS_ORIGIN=http://localhost:4200,https://tu-dominio.com

# Token de autenticación para la API (Bearer Token)
API_TOKEN=tu-token-secreto-aqui
```

> **⚠️ Importante:** Nunca subas el archivo `.env` al repositorio. Está incluido en `.gitignore`. Las credenciales de Firebase son sensibles y permiten acceso completo a la base de datos.

### Frontend (`frontend/.env.example`)

El frontend puede requerir la URL de la API y el token configurados como variables de entorno del build (ver `frontend/.env.example`).

---

## Guía de instalación y ejecución

### Requisitos previos

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- Cuenta de Firebase con un proyecto Firestore configurado
- Archivo `.env` con las credenciales de Firebase y el `API_TOKEN`

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Bale-e/Back_y_front.git
cd Back_y_front

# 2. Instalar dependencias del backend
cd backEnd
npm install

# 3. Instalar dependencias del frontend
cd ../frontend
npm install
```

### Desarrollo (backend y frontend por separado)

**Backend** (terminal 1):
```bash
cd backEnd
npm run dev     # desarrollo con nodemon → http://localhost:3000
# o
npm start       # producción
```

**Frontend** (terminal 2):
```bash
cd frontend
npm start       # Angular DevServer → http://localhost:4200
```

### Comandos disponibles

**Backend (`backEnd/`):**

```bash
npm start             # inicia con node (producción)
npm run dev           # inicia con nodemon (desarrollo, recarga automática)
npm run test:backend  # ejecuta los tests manuales de los endpoints
```

**Frontend (`frontend/`):**

```bash
npm start       # Angular DevServer (http://localhost:4200)
npm run build   # compila para producción → frontend/dist/
npm run watch   # compila en modo watch (desarrollo)
```

### Modo monolítico (producción sin Docker)

En producción, el backend Express sirve los archivos compilados del frontend directamente:

```bash
# 1. Compilar el frontend
npm run build:frontend

# 2. Iniciar el backend (sirve la SPA en /)
npm start
# → Todo disponible en http://localhost:3000
```

El backend detecta automáticamente si existe `frontend/dist/inamap-angular/browser` o `frontend/dist/inamap-angular` y sirve el `index.html` para cualquier ruta que no sea de la API.

---

## Despliegue con Docker

El frontend incluye un `Dockerfile` multi-etapa:

```dockerfile
# Etapa 1: compilación Angular
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: Nginx sirve los estáticos compilados
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

**Nginx** está configurado para:
- Servir la SPA de Angular (todas las rutas redirigen a `index.html` para el routing del cliente)
- Cachear assets estáticos (JS, CSS, imágenes) durante 6 meses

```bash
# Construir la imagen del frontend
cd frontend
docker build -t inago-frontend .

# Ejecutar el contenedor
docker run -p 80:80 inago-frontend
```

---

## Algoritmos y lógica clave

### Algoritmo A* para navegación

El `AStarAlgorithm` implementa la búsqueda de camino más corto en un grafo topológico:

- **Estructura de datos**: `Set` para `openSet`, `Map` para `gScore` y `fScore`
- **Heurística**: distancia euclidiana 3D entre el nodo actual y el nodo destino usando `Point3D.distanceTo()`
- **Complejidad**: O((V + E) log V) en la práctica con el grafo de navegación del campus
- **Caso borde**: si inicio === destino, retorna una ruta de longitud 0 directamente

### Cálculo de punto de inflexión en 90°

`findTurnPointOnPath()` en `CalcularRutaUseCase` proyecta el destino perpendicularmente sobre cada segmento del pasillo:

1. Para cada segmento del camino (inicio → giro₁ → giro₂ → ... → giroN)
2. Proyecta el destino sobre el segmento y calcula la distancia perpendicular
3. El segmento con menor distancia es el tramo del pasillo más cercano a la sala
4. Interpola el punto exacto sobre ese segmento → `turnPoint`
5. La ruta final es: `[inicio] → [giros previos al turnPoint] → [turnPoint] → [destino]`

Esto garantiza que la flecha siempre gire exactamente a 90° frente a la puerta de la sala, sin importar dónde estén los giros precalculados del pasillo.

### Transición entre pisos (frontend)

`loadModelWithTransition()` en `BabylonSceneService` anima el cambio de piso en 3 etapas durante 2200ms:

| Etapa | Duración | Descripción |
|---|---|---|
| **1 — Acercamiento** | 0% → 44% | El nuevo piso entra desde arriba/abajo (`easeOutCubic`) |
| **2 — Proximidad** | 44% → 64% | Ambos pisos visibles y cercanos (pausa de ~440ms) |
| **3 — Alejamiento** | 64% → 100% | El piso anterior sale y se desvanece (`easeInOutQuad`) |

La dirección (`'up'` o `'down'`) se determina comparando el número de piso actual con el destino.

### Indicaciones de navegación paso a paso

`getStepInstruction()` genera instrucciones textuales para cada segmento de la ruta:
- Detecta el eje dominante de cada segmento (X o Z)
- Si el eje cambia entre segmentos consecutivos, calcula la dirección del giro usando el **producto cruzado 2D** (`cross = prevDx * dz - prevDz * dx`)
- `cross > 0` → "Gira a la izquierda" / `cross < 0` → "Gira a la derecha"
- Primer segmento → "Sal por la entrada principal"
- Último segmento → "Has llegado a tu destino 🎯"

---

## Beneficios de la arquitectura

| Beneficio | Descripción |
|---|---|
| **Independencia del framework** | La lógica de negocio no conoce Express ni Firebase; solo interfaces |
| **Testabilidad** | Los casos de uso se pueden probar con repositorios mock sin levantar Firestore |
| **Extensibilidad** | Añadir un nuevo edificio, piso o fuente de datos solo requiere un nuevo adapter |
| **Separación de responsabilidades** | Cada módulo tiene una responsabilidad única y clara |
| **Caché transparente** | `MemoryCacheAdapter` puede intercambiarse por Redis sin tocar los casos de uso |
| **Frontend desacoplado** | El frontend solo consume la API REST; no conoce Firestore ni Express |
| **Monorepo organizado** | Backend y frontend co-existen con scripts de orquestación claros desde la raíz |

---

## Estado actual y roadmap

### Funcionalidades implementadas ✅

- [x] API REST hexagonal con 12+ endpoints
- [x] Autenticación por Bearer Token en todos los endpoints protegidos
- [x] Caché en memoria con TTL configurable
- [x] Cálculo de rutas con punto de inflexión exacto en 90°
- [x] Algoritmo A* para grafos topológicos
- [x] Visualización 3D con BabylonJS (modelos OBJ)
- [x] Soporte para Edificio A (3 pisos), Edificio B (3 pisos), Edificio C (1 piso) y Sede
- [x] Transiciones animadas entre pisos (3 etapas, 2200ms)
- [x] Marcadores HTML proyectados sobre objetos 3D
- [x] Auto-rotación de presentación del mapa de la Sede
- [x] Buscador con autocompletado de destinos (hasta 8 sugerencias)
- [x] Panel de información de sala al hacer clic en un mesh
- [x] Indicaciones de navegación paso a paso con detección de giros
- [x] Modo monolítico (backend sirve el frontend compilado)
- [x] Dockerfile + Nginx para el frontend
- [x] CORS multi-origen configurable

### Mejoras pendientes / roadmap 🔜

- [ ] Navegación multi-piso completa (cruzar entre pisos automáticamente)
- [ ] Soporte para más edificios del campus
- [ ] Búsqueda por tipo de espacio (laboratorio, baño, secretaría)
- [ ] Modo oscuro/claro en el frontend
- [ ] Tests unitarios automatizados con Jest
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Dockerización del backend
- [ ] Soporte offline con Service Worker

---

*Proyecto desarrollado para INACAP — Sistema de navegación indoor para el campus universitario.*
