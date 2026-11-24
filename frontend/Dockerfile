# ===== Etapa 1: BUILD (compila Angular) =====
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# ===== Etapa 2: SERVIDO (Nginx sirve estáticos) =====
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Angular 17 deja el sitio en dist/inamap-angular/browser (antes se copiaba
# dist/ completo, restos de una plantilla de React/Vite)
COPY --from=build /app/dist/inamap-angular/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
