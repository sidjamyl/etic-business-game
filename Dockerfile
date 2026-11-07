# syntax=docker/dockerfile:1
# Single image (S11): the Bun server, which also serves the built web app.
# Internal packages ship their TypeScript sources; Bun runs them without a build step.

ARG BUN_VERSION=1.4.2

# Dependencies, cached as long as the manifests and the lockfile do not change.
FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY packages/content/package.json packages/content/
RUN bun install --frozen-lockfile

# Web app build (Vite).
FROM deps AS web
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/server apps/server
COPY apps/web apps/web
RUN bun run --filter @etic/web build

# Production dependencies only.
FROM oven/bun:${BUN_VERSION}-alpine AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY packages/content/package.json packages/content/
RUN bun install --frozen-lockfile --production

FROM oven/bun:${BUN_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
# Manifests and node_modules of every workspace (isolated linker: symlinks into node_modules/.bun).
COPY --from=prod-deps /app ./
COPY tsconfig.base.json ./
COPY packages/engine/tsconfig.json packages/engine/
COPY packages/engine/src packages/engine/src
COPY packages/content/tsconfig.json packages/content/
COPY packages/content/src packages/content/src
COPY apps/server/tsconfig.json apps/server/
COPY apps/server/src apps/server/src
COPY apps/server/drizzle apps/server/drizzle
COPY --from=web /app/apps/web/dist apps/web/dist

USER bun
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["bun", "apps/server/src/index.ts"]
