# InaGo — Frontend Angular 3D (BabylonJS)

> Aplicación web Single Page Application (SPA) desarrollada con **Angular 17** y el motor WebGL **BabylonJS 7**. Proporciona un visor 3D interactivo del campus de INACAP con navegación indoor, selector de edificios y pisos, panel de administración y cálculo visual de rutas guiadas paso a paso.

---

## Tabla de contenidos

1. [Visión general](#visión-general)
2. [Estructura del frontend](#estructura-del-frontend)
3. [Componentes y servicios clave](#componentes-y-servicios-clave)
4. [Modelos 3D y formatos](#modelos-3d-y-formatos)
5. [Instalación y ejecución](#instalación-y-ejecución)
6. [Despliegue con Docker y Nginx](#despliegue-con-docker-y-nginx)
7. [Scripts y herramientas](#scripts-y-herramientas)

---

## Visión general

El frontend de InaGo permite a estudiantes, docentes y visitantes recorrer virtualmente la sede y los edificios de INACAP:
- **Visualización 3D diurna:** Renderizado acelerado por hardware con iluminación ambiental, cielo diurno y texturas cartográficas de asfalto y pasto perimetral.
- **Navegación inteligente:** Búsqueda en tiempo real de salas, laboratorios y oficinas con sugerencias autocompletadas.
- **Rutas animadas:** Trazado de flechas guía en 3D en el suelo, con codos en 90° frente a las puertas y tarjetas de indicaciones paso a paso.
- **Transiciones entre pisos:** Cambio fluido entre pisos con cinemática vertical de cámara.
- **Panel de administración:** Interfaz dedicada para gestión y revisión de datos (`AdminPanelComponent`).

---

## Estructura del frontend

```text
frontend/
├── angular.json                      ← Configuración del workspace Angular
├── Dockerfile                        ← Build multi-etapa: compilación Angular → Nginx alpine
├── nginx.conf                        ← Configuración de Nginx para SPA (rutas y caché)
├── package.json                      ← Dependencias (Angular 17, BabylonJS 7, RxJS)
├── tsconfig.json / tsconfig.app.json ← Configuración de TypeScript
├── .env.example                      ← Plantilla de configuración de entorno
│
├── scripts/                          ← Herramientas de utilidad
│   └── inspect_obj.js                ← Inspección de mallas y vértices de archivos OBJ
│
└── src/
    ├── index.html                    ← Entrada HTML con viewport y metadatos
    ├── main.ts                       ← Bootstrap de la aplicación Angular
    ├── polyfills.ts                  ← Compatibilidad con Zone.js
    │
    ├── app/
    │   ├── app.module.ts             ← Módulo raíz de Angular
    │   ├── app.component.ts          ← Orquestación de vistas y modal de administración
    │   │
    │   ├── admin/                    ← Panel de administración de salas y datos
    │   │   ├── admin-panel.component.html
    │   │   ├── admin-panel.component.scss
    │   │   └── admin-panel.component.ts
    │   │
    │   ├── core/                     ← Configuración e interfaces de dominio del cliente
    │   │   ├── config/
    │   │   │   └── api.config.ts     ← URL base del backend y headers de autenticación
    │   │   └── models/               ← Interfaces TypeScript (Edificio, Locacion, Floor, etc.)
    │   │
    │   ├── map3d/                    ← Módulo principal del visor 3D
    │   │   ├── map3d.module.ts
    │   │   ├── components/
    │   │   │   ├── map3d-container.component.*   ← Contenedor principal de la escena y UI
    │   │   │   ├── floor-selector/               ← Selector flotante de edificio y piso
    │   │   │   ├── location-detail-panel/        ← Tarjeta lateral de información de sala
    │   │   │   ├── map-controls/                 ← Controles de zoom, reset y perspectiva
    │   │   │   └── map-search/                   ← Buscador con autocompletado
    │   │   └── services/
    │   │       ├── babylon-scene.service.ts      ← Motor 3D, cámara, mallas, luces, materiales
    │   │       ├── guide-arrow.service.ts        ← Creación de flechas 3D animadas
    │   │       └── map-navigation.service.ts     ← Estado reactivo de navegación (RxJS)
    │   │
    │   ├── services/                 ← Clientes HTTP hacia la API REST
    │   │   ├── espacios-api.service.ts           ← Consultas de edificios y locaciones
    │   │   └── navegacion-api.service.ts         ← Consultas de rutas y puntos de paso
    │   │
    │   └── shared/                   ← Módulos auxiliares compartidos
    │       └── shared.module.ts
    │
    └── assets/                       ← Recursos estáticos
        ├── 3d-models/                ← Geometrías OBJ y materiales MTL
        │   ├── Edificio A/           ← Pisos 1, 2 y 3
        │   ├── Edificio B/           ← Pisos 1, 2 y 3
        │   ├── Edificio C/           ← Pisos 1 y 2
        │   ├── Edificio D/           ← Pisos 1 y 2
        │   └── sede/                 ← Modelo global del campus (Instituto3D-color.obj/.mtl)
        ├── icons/                    ← Iconografía de la interfaz
        ├── images/                   ← Imágenes de apoyo
        └── styles/                   ← Estilos globales SCSS y variables de diseño
```

---

## Componentes y servicios clave

| Elemento | Tipo | Función |
|---|---|---|
| `Map3dContainerComponent` | Componente | Orquesta la escena BabylonJS, eventos de selección, click en mallas y tarjetas de navegación paso a paso. |
| `BabylonSceneService` | Servicio | Controla el motor BabylonJS: carga de modelos OBJ con materiales MTL, cámara orbital (`ArcRotateCamera`), iluminación diurna, texturas dinámicas de suelo y animación de rutas. |
| `MapNavigationService` | Servicio | Almacena el estado reactivo (`BehaviorSubject`) del edificio actual, piso activo, destino seleccionado y lista de salas. |
| `AdminPanelComponent` | Componente | Panel modal para inspeccionar y administrar la información de espacios y destinos. |
| `FloorSelectorComponent` | Componente | Selector interactivo de piso con detección de click exterior y animación de apertura. |
| `MapSearchComponent` | Componente | Campo de búsqueda de destinos con filtrado reactivo de hasta 8 sugerencias inmediatas. |
| `GuideArrowService` | Servicio | Genera meshes compuestos (cono + cilindro) para representar flechas 3D animadas sobre el piso. |
| `EspaciosApiService` | Servicio | Cliente HTTP con Bearer Token para consultar edificios y locaciones desde el backend. |
| `NavegacionApiService` | Servicio | Cliente HTTP para solicitar rutas enriquecidas (`/navegacion/ruta`). |

---

## Modelos 3D y formatos

Los modelos se ubican en `src/assets/3d-models/` y son cargados dinámicamente mediante `babylonjs-loaders`:

- **Wavefront OBJ (`.obj`):** Define la geometría tridimensional, caras y nombres de grupo de mallas (`cuerpoN` para salas).
- **Material Template Library (`.mtl`):** Define los colores y materiales referenciados en cada archivo OBJ.

Modelos disponibles en la aplicación:
- **Campus Completo:** `assets/3d-models/sede/Instituto3D-color.obj`
- **Edificio A:** Pisos 1, 2 y 3 (`.obj` + `.mtl`)
- **Edificio B:** Pisos 1, 2 y 3 (`.obj` + `.mtl`)
- **Edificio C:** Pisos 1 y 2 (`.obj` + `.mtl`)
- **Edificio D:** Pisos 1 y 2 (`.obj`)

---

## Instalación y ejecución

### Requisitos
- **Node.js** ≥ 18.x
- **npm** ≥ 9.x

### Instalar dependencias
```bash
cd frontend
npm install
```

### Ejecutar servidor de desarrollo
```bash
npm start
# o
npm run dev
```
La aplicación estará disponible en `http://localhost:4200` con recarga automática ante cambios.

### Compilar para producción
```bash
npm run build
```
Los archivos optimizados se generan en `frontend/dist/`.

---

## Despliegue con Docker y Nginx

El proyecto incluye un `Dockerfile` multi-etapa listo para producción:

1. **Etapa de build:** Compila la aplicación Angular en una imagen `node:20-alpine`.
2. **Etapa de servidor:** Copia los artefactos compilados a `nginx:alpine` y aplica `nginx.conf` con enrutamiento de SPA (soporte para HTML5 History API).

### Construir y levantar el contenedor:
```bash
docker build -t inago-frontend .
docker run -d -p 80:80 --name inago-app inago-frontend
```

---

## Scripts y herramientas

En `frontend/scripts/inspect_obj.js` se dispone de una herramienta de Node.js para inspeccionar archivos OBJ:
```bash
node scripts/inspect_obj.js
```
Reporta el número total de mallas, recuento de vértices y centro geométrico tridimensional `(X, Y, Z)` de cada sala, permitiendo calibrar bounding boxes y coordenadas de navegación.
