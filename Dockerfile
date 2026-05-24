# Pixel Realms — server Dockerfile (for Fly.io / Railway / Render).
# Multi-stage to keep the runtime image small (no devDependencies).

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate
WORKDIR /app

# ── Install: copy lockfiles + manifests, install full workspace ────────
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
# Skip @pr/client — server doesn't need it.
RUN pnpm install --frozen-lockfile --filter "@pr/server..."

# ── Build: TypeScript → JS for shared and server ───────────────────────
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
# Server build relies on shared's source via workspace alias; tsx works
# directly. Production uses tsx at runtime so no transpile step needed.

# ── Runtime ────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# Install only production deps to keep image lean.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter "@pr/server..."
# tsx is a devDependency; install it directly into the server workspace
# so the runtime can execute TypeScript without a build step.
RUN pnpm add --filter "@pr/server" tsx@^4.19.2

COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/server ./apps/server

EXPOSE 2567
ENV PORT=2567
WORKDIR /app/apps/server
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
