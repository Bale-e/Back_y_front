# InaGo - Backend Hexagonal + Frontend 3D

Este proyecto combina un backend Node.js/Express con una arquitectura hexagonal y un frontend Angular que visualiza el mapa de INACAP en 2D/3D con BabylonJS. La idea es separar claramente la lógica de negocio, la navegación y la gestión de espacios del acceso a datos y de la capa HTTP para mantener el sistema más testeable, extensible y fácil de evolucionar.

## Visión general

- Backend: API REST centrada en casos de uso y servicios del dominio.
- Arquitectura: hexagonal (ports & adapters) con capas de dominio, aplicación, infraestructura y presentación.
- Datos: Firebase Firestore como fuente principal de edificios, locaciones, rutas y grafos de navegación.
- Frontend: Angular + BabylonJS para renderizar edificio, pisos, rutas y puntos de interés.

---

## Esquema completo del proyecto

```text
Back_y_front/
├── package.json                          # Dependencias globales del monorepo y scripts del backend
├── server.js                             # Punto de entrada del backend para levantar Express
├── README.md                             # Documentación principal del proyecto
├── scratch/
│   └── test_hexagonal_endpoints.js       # Script de comprobación de endpoints y flujo hexagonal
├── src/
│   ├── app.js                            # Bootstrap principal de la API Express
│   ├── modules/
│   │   ├── api/
│   │   │   ├── infrastructure/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── NavegacionController.js
│   │   │   │   ├── middlewares/
│   │   │   │   │   ├── corsConfig.js
│   │   │   │   │   └── errorHandler.js
│   │   │   │   └── routes/
│   │   │   │       ├── navegacion.routes.js
│   │   │   │       ├── edificios.routes.js
│   │   │   │       └── locaciones.routes.js
│   │   │   └── presentation/
│   │   │       └── view-models/
│   │   ├── gestion_espacios/
│   │   │   ├── application/
│   │   │   │   ├── dtos/
│   │   │   │   └── use-cases/
│   │   │   ├── domain/
│   │   │   │   ├── models/
│   │   │   │   └── ports/
│   │   │   └── infrastructure/
│   │   │       ├── helpers/
│   │   │       ├── mappers/
│   │   │       └── repositories/
│   │   ├── sistema_navegacion/
│   │   │   ├── application/
│   │   │   │   ├── dtos/
│   │   │   │   ├── ports/
│   │   │   │   └── use-cases/
│   │   │   ├── domain/
│   │   │   │   ├── models/
│   │   │   │   ├── ports/
│   │   │   │   └── services/
│   │   │   └── infrastructure/
│   │   │       ├── mappers/
│   │   │       └── repositories/
│   │   ├── visualizacion_mapa/
│   │   │   ├── application/
│   │   │   │   ├── dtos/
│   │   │   │   └── use-cases/
│   │   │   ├── domain/
│   │   │   │   ├── models/
│   │   │   │   └── services/
│   │   │   └── infrastructure/
│   │   │       └── transformers/
│   │   └── shared/
│   │       ├── domain/
│   │       │   ├── errors/
│   │       │   │   ├── DomainError.js
│   │       │   │   ├── NotFoundError.js
│   │       │   │   └── ValidationError.js
│   │       │   └── value-objects/
│   │       │       ├── Angle.js
│   │       │       ├── Point3D.js
│   │       │       └── Vector2D.js
│   │       └── infrastructure/
│   │           ├── cache/
│   │           │   └── MemoryCacheAdapter.js
│   │           └── firebase/
│   │               └── firebaseAdmin.js
│   └── ...
├── frontend/
│   ├── angular.json                    # Configuración del proyecto Angular
│   ├── Dockerfile                      # Imagen de despliegue del frontend
│   ├── nginx.conf                      # Configuración de nginx para servir la app
│   ├── package.json                    # Dependencias y scripts del frontend
│   ├── README.md                       # Documentación específica del cliente
│   └── src/
│       ├── index.html                  # Entrada HTML principal
│       ├── main.ts                     # Arranque Angular
│       ├── polyfills.ts                # Compatibilidad para navegadores
│       ├── app/
│       │   ├── app.module.ts           # Módulo raíz Angular
│       │   ├── app.component.ts        # Componente principal
│       │   ├── app.component.html      # Template principal
│       │   ├── app.component.scss      # Estilos principales
│       │   ├── core/
│       │   │   ├── config/
│       │   │   │   └── api.config.ts
│       │   │   └── models/
│       │   │       ├── building.model.ts
│       │   │       ├── edificio.model.ts
│       │   │       ├── floor.model.ts
│       │   │       ├── locacion.model.ts
│       │   │       ├── navegacion.model.ts
│       │   │       └── navigation.model.ts
│       │   ├── map3d/
│       │   │   ├── components/
│       │   │   │   ├── map3d-container.component.ts
│       │   │   │   ├── map3d-container.component.html
│       │   │   │   ├── map3d-container.component.scss
│       │   │   │   ├── floor-selector/
│       │   │   │   ├── location-detail-panel/
│       │   │   │   ├── map-controls/
│       │   │   │   └── map-search/
│       │   │   ├── map3d.module.ts
│       │   │   └── services/
│       │   │       ├── babylon-scene.service.ts
│       │   │       ├── guide-arrow.service.ts
│       │   │       └── ...
│       │   ├── services/
│       │   │   ├── espacios-api.service.ts
│       │   │   └── navegacion-api.service.ts
│       │   └── shared/
│       │       └── shared.module.ts
│       ├── assets/
│       │   ├── 3d-models/
│       │   │   ├── Edificio A/
│       │   │   ├── Edificio B/
│       │   │   └── sede/
│       │   ├── icons/
│       │   ├── images/
│       │   ├── js/
│       │   │   └── cuerpo23-browser-overlay.js
│       │   └── styles/
│       │       ├── _mixins.scss
│       │       ├── _variables.scss
│       │       └── styles.scss
│       └── environments/ (si se agrega más adelante)
└── ...
```

## ¿Por qué esta estructura es importante?

La organización del proyecto no es casual: cada carpeta cumple una función específica dentro de la arquitectura y ayuda a mantener la aplicación ordenada y ampliable.

### 1) `src/` y `src/modules/`
Es el núcleo del backend. Aquí se encapsula toda la lógica del negocio por dominio funcional:

- `gestion_espacios`: gestión de edificios, pisos y ubicaciones.
- `sistema_navegacion`: cálculo de rutas, grafos, nodos y caminos.
- `visualizacion_mapa`: preparación de rutas y coordenadas para mostrarlas en pantalla.
- `api`: entradas y salidas HTTP, validaciones, middlewares y controladores.
- `shared`: utilidades y abstracciones reutilizables para todo el sistema.

Esta división permite que cada módulo tenga una responsabilidad clara y no mezcle acceso a datos, reglas de negocio y control HTTP en el mismo sitio.

### 2) `src/shared/`
Contiene piezas transversales, como:

- errores del dominio (`DomainError`, `ValidationError`, `NotFoundError`)
- value objects (`Point3D`, `Angle`, `Vector2D`)
- caché en memoria (`MemoryCacheAdapter`)
- conexión a Firebase (`firebaseAdmin.js`)

Esto evita duplicar logic y permite reutilizar conceptos comunes entre distintos módulos.

### 3) `src/modules/api/`
Esta es la capa de adaptación hacia el exterior. Aquí se exponen endpoints REST y se convierten peticiones HTTP en acciones del sistema.

Sus partes clave son:

- `routes/`: define las rutas disponibles
- `controllers/`: procesa la petición y delega al caso de uso
- `middlewares/`: seguridad, CORS, manejo de errores y validaciones
- `presentation/view-models/`: estructuras que preparan la respuesta para el cliente

Sin esta capa, la lógica de negocio no podría ser consumida por un navegador o por terceros.

### 4) `server.js` y `src/app.js`
Estos archivos arrancan toda la aplicación.

- `server.js`: es el entry point del backend. Levanta el servidor y define el puerto.
- `src/app.js`: configura Express, registra rutas, monta middlewares y prepara la API.

Son la base desde la que la aplicación se vuelve ejecutable y accesible.

### 5) `frontend/src/app/`
Aquí vive la interfaz del usuario.

- `core/`: modelos, tipos y configuración global
- `map3d/`: lógica principal del mapa 3D y componentes visuales
- `services/`: comunicación con la API y lógica de consumo de datos
- `shared/`: módulos y utilidades reutilizables

Este bloque convierte la información del backend en una experiencia visual interactiva para el usuario.

### 6) `frontend/src/assets/`
Son los recursos gráficos y 3D del sistema:

- modelos 3D de edificios y sedes
- iconos y imágenes
- estilos visuales
- overlays y recursos necesarios para la navegación visual

Gracias a esta separación, la capa visual no queda mezclada con la lógica del negocio ni con la infraestructura del backend.

---

## Arquitectura hexagonal aplicada

La capa de dominio contiene las entidades y reglas de negocio fundamentales:

- modelos de edificios, locaciones, pisos y rutas
- value objects como `Point3D`, `Angle` y `Vector2D`
- errores del dominio como `ValidationError` y `NotFoundError`
- servicios de navegación y visualización

La capa de aplicación encapsula los casos de uso:

- listar edificios
- obtener un edificio por ID
- buscar ubicaciones
- calcular rutas
- preparar visualizaciones para el frontend

La capa de infraestructura implementa adaptadores:

- repositorios Firestore
- mappers de documentos a modelos del dominio
- caché en memoria
- autenticación y configuración de Firebase
- middlewares HTTP, rutas y controladores

Esto permite que el negocio no dependa de Express, Firebase ni de Angular directamente; cada detalle técnico queda atrás de interfaces y puertos.

---

## Funciones principales del backend

### 1) Gestión de espacios
Responsable del catálogo de edificios y ubicaciones.

Incluye:

- listado de edificios
- consulta por ID o nombre
- listado de locaciones por edificio, piso o tipo
- búsqueda global de locaciones
- normalización de datos provenientes de Firestore

Se resuelve principalmente en `src/modules/gestion_espacios`.

### 2) Sistema de navegación
Responsable de construir el grafo de navegación y resolver rutas internas.

Incluye:

- lectura de paths y nodos de navegación
- cálculo de rutas entre ubicaciones
- validación de arcos, nodos y puntos 3D
- preparación de información para la visualización

Se resuelve en `src/modules/sistema_navegacion`.

### 3) Visualización del mapa
Genera la estructura necesaria para mostrar una ruta en el mapa:

- orientación de flechas
- suavizado de polilíneas
- transformación de coordenadas para visualización
- preparación de datos para renderizar trazas en mapas 2D/3D

Se resuelve en `src/modules/visualizacion_mapa`.

### 4) API REST
La capa HTTP está en `src/modules/api` y ofrece los endpoints para que el frontend consuma la información.

---

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

---

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

La API queda disponible en `http://localhost:3000` por defecto, salvo que se configure otra variable de entorno.

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

---

## Frontend

El frontend está en la carpeta `frontend` y se desarrolla con Angular. Su función es:

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
│   ├── images/
│   └── styles/
├── index.html
├── main.ts
├── polyfills.ts
└── ...
```

### Lógica destacada del frontend

- `map3d-container.component.ts`: orquesta la vista del mapa, selección de pisos y navegación general.
- `babylon-scene.service.ts`: carga modelos 3D, ajusta cámara, iluminación y renderizado de objetos.
- `espacios-api.service.ts` y `navegacion-api.service.ts`: encapsulan la interacción con la API REST.

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

---

## Stack tecnológico

| Tecnología | Uso principal |
| --- | --- |
| Node.js | Runtime del backend |
| Express | API REST |
| Firebase Admin | Conexión a Firestore |
| Angular | Frontend SPA |
| BabylonJS | Render 3D del mapa |
| RxJS | Gestión reactiva del estado y eventos |

---

## Qué aporta esta arquitectura

- separación clara entre negocio e infraestructura
- casos de uso reutilizables
- menor acoplamiento entre API y Firebase
- facilidad para introducir nuevas fuentes de datos o visualizaciones
- mejor mantenimiento de navegación y modelos del campus

## Estado del proyecto

El sistema está orientado a ser una base de navegación y gestión espacial para INACAP, con un backend hexagonal bien segmentado y un frontend visual interactivo sobre modelos 3D. Es una solución monorepo preparada para crecer con más edificios, más rutas, más locaciones y más servicios de búsqueda.
