# Pixel Realms — server Dockerfile (for Render / Fly.io / Railway / Koyeb).
# Single-stage: simpler, more reliable. Image stays small because tsx is
# tiny and we don't need any compiled output (runs TypeScript directly).

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate
WORKDIR /app

# Copy manifests + lockfile first for better Docker layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Install all deps for the server workspace (includes tsx via devDependencies).
RUN pnpm install --frozen-lockfile --filter "@pr/server..."

# Copy source code.
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

ENV NODE_ENV=production
EXPOSE 2567
WORKDIR /app/apps/server
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
