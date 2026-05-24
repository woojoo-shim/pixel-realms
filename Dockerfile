# Pixel Realms — server Dockerfile
# Bundles server + all deps into one CJS file with esbuild at build time, so
# the runtime is just `node dist/server.cjs` — no tsx, no tsconfig discovery
# issues, no decorator-transform surprises. Image is tiny.

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate
WORKDIR /app

# Manifests + lockfile first → better layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --filter "@pr/server..."

# Source.
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

# Bundle: esbuild reads apps/server/tsconfig.json explicitly so
# experimentalDecorators is honored (Colyseus needs the legacy transform).
WORKDIR /app/apps/server
RUN ../../node_modules/.bin/esbuild src/index.ts \
      --bundle \
      --platform=node \
      --target=node22 \
      --format=cjs \
      --outfile=dist/server.cjs \
      --tsconfig=./tsconfig.json \
      --external:bufferutil \
      --external:utf-8-validate

# Runtime: minimal node image, just the bundle.
FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/apps/server/dist/server.cjs ./server.cjs
ENV NODE_ENV=production
EXPOSE 2567
CMD ["node", "server.cjs"]
