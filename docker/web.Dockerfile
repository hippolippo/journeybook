# syntax=docker/dockerfile:1

# Journeybook SPA, built and served by Caddy.
# Build from the repository root:
#   docker build -f docker/web.Dockerfile --build-arg APP_BASE=/journeybook -t journeybook-web .
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# APP_BASE is the URL path the app is served under (e.g. /journeybook). It drives
# both Vite's asset base and the PocketBase client URL, so one value configures
# the whole subpath.
ARG APP_BASE=/
ENV VITE_BASE=$APP_BASE
ENV VITE_PB_URL=$APP_BASE
RUN pnpm build

FROM caddy:2.8-alpine

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
