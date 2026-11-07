# syntax=docker/dockerfile:1
#
# React (Vite) frontend.
#   dev  — `npm start` (vite dev server), source bind-mounted, hot reload
#   prod — `npm run build`, output served by nginx (see nginx.conf), which
#          also reverse-proxies /api and /media to the backend container —
#          so the SPA can call relative "/api" and needs no baked-in host.

FROM node:20-alpine AS base
WORKDIR /app

# ────────────────────────────────────────────────────────────────────────
FROM base AS dev
COPY package.json package-lock.json ./
# --legacy-peer-deps: react-simple-maps' peer range (react 16-18) predates the
# repo's React 19 upgrade; the committed package-lock.json already reflects
# that resolution, this just stops a from-scratch install re-checking it.
RUN npm install --legacy-peer-deps
# Source is bind-mounted over this in docker-compose.yml; COPY here just
# keeps `docker build --target dev` usable standalone.
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

# ────────────────────────────────────────────────────────────────────────
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
# Baked into the JS bundle at build time (Vite can't read env at runtime;
# REACT_APP_* is exposed via envPrefix in vite.config.mjs).
# Defaults to a relative path so nginx.conf's /api proxy handles it — override
# with --build-arg REACT_APP_API_URL=https://your-host/api for a standalone
# frontend deploy that talks to a differently-hosted backend.
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY --from=build /app/build /usr/share/nginx/html
# A template: filled in at start-up from BACKEND_UPSTREAM / NGINX_LOCAL_RESOLVERS
# and written to /etc/nginx/conf.d/default.conf (see the notes in nginx.conf).
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV BACKEND_UPSTREAM=backend:8000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
