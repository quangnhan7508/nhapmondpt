# This repo is an npm workspaces monorepo: a single root package-lock.json
# covers both client/ and server/, so `npm ci` must run from the repo root
# with every workspace's package.json present.

# Stage 1: Build client + server
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci
COPY client ./client
COPY server ./server
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Prod dependencies only (root + both workspace manifests)
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci --omit=dev && npm cache clean --force

# Compiled server serves the SPA from ../../client/dist (i.e. /app/client/dist)
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3000

CMD ["node", "server/dist/server.js"]
