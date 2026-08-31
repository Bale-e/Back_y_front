# Inamap Angular

Sistema de navegación interior 3D/2D para instalaciones de INACAP, construido con Angular 17 y BabylonJS.

## Estructura del Proyecto

```
Inamap-Angular/
├── src/                  # Frontend Angular
│   ├── app/
│   │   ├── core/         # Modelos e interfaces de dominio
│   │   ├── features/     # Módulos de funcionalidad (map3d)
│   │   ├── services/     # Servicios de Angular (Firebase, API, rutas)
│   │   └── shared/       # Módulos compartidos
│   ├── assets/           # Modelos 3D, estilos, iconos
│   └── environments/     # Variables de entorno (dev/prod)
├── server/               # Backend Express + Firebase Admin
│   ├── index.js          # Servidor REST
│   └── package.json      # Dependencias del backend
└── scripts/              # Utilidades de Node para Firestore
```

## Cómo ejecutar

### Frontend (Angular)
```bash
npm install
npm start            # http://localhost:4200
```

### Backend (Express)
```bash
cd server
npm install
npm run dev          # http://localhost:3000
```

> ⚠️ Asegúrate de colocar `ServiceAccountKey.json` en la carpeta `server/` antes de iniciar el backend.

## Stack

| Tecnología | Uso |
|---|---|
| Angular 17 | Framework frontend |
| BabylonJS 7 | Renderizado 3D |
| Firebase/Firestore | Base de datos |
| Express | API REST del backend |

## Variables de entorno

El frontend usa `src/environments/environment.ts` (dev) y `environment.prod.ts` (prod).  
El backend usa `server/ServiceAccountKey.json` y opcionalmente `server/.env`.