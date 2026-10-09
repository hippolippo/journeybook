# syntax=docker/dockerfile:1

# Journeybook SPA, built and served by Caddy.
# Build from the repository root:
#   docker build -f docker/web.Dockerfile -t journeybook-web .
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_PB_URL=/
ENV VITE_PB_URL=$VITE_PB_URL
RUN pnpm build

FROM caddy:2.8-alpine

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
