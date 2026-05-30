# syntax=docker/dockerfile:1.7
# Multi-stage build for uxwVend. Node 24 matches package.json engines.node.
#
# Stages:
#   deps    — install every dep (dev + prod) so the builder can compile TS.
#   builder — runs prisma generate + next build, produces .next + generated files.
#   runner  — minimal runtime with a non-root user and a HEALTHCHECK that
#             probes /api/health.
#
# Runtime notes:
#   - src/modules/ is NOT copied. The runner starts with zero modules
#     installed, matching the "fresh install" motto. An admin installs
#     modules from module-marketplace/*.zip via the admin UI after boot.
#   - HEALTHCHECK uses wget (Alpine ships BusyBox wget) to hit the probe
#     endpoint — any 200/degraded response keeps the container healthy.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Regenerate the Prisma client + merged schema + module + theme registries
# from committed source. scripts/postinstall.ts does this automatically on
# `npm ci`, but we also need a full `next build` here.
RUN npx tsx scripts/merge-schemas.ts && \
    npx tsx scripts/generate-theme-registry.ts && \
    npx tsx scripts/generate-registry.ts && \
    npx tsx scripts/generate-openapi.ts && \
    npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user so an RCE via a module hook cannot write outside /app.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# Minimal runtime surface — the builder's .next, the generated Prisma
# client, marketplace ZIPs, and the scripts the runtime still invokes
# (generate-registry runs on module install, merge-schemas on module
# schema updates, apply-migrations on module install).
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/src/core ./src/core
COPY --from=builder --chown=nextjs:nodejs /app/src/app ./src/app
COPY --from=builder --chown=nextjs:nodejs /app/src/themes ./src/themes
COPY --from=builder --chown=nextjs:nodejs /app/src/proxy.ts ./src/proxy.ts
COPY --from=builder --chown=nextjs:nodejs /app/module-marketplace ./module-marketplace
COPY --from=builder --chown=nextjs:nodejs /app/module-sources ./module-sources
COPY --from=builder --chown=nextjs:nodejs /app/messages-core ./messages-core

# src/modules starts empty; admin installs from /admin/modules after boot.
RUN mkdir -p src/modules && chown -R nextjs:nodejs src/modules

USER nextjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1

# Let Next.js + the shutdown registry catch SIGTERM cleanly. Do not wrap
# with a shell or exec sh -c — that eats the signal.
CMD ["npx", "next", "start", "-p", "3001", "-H", "0.0.0.0"]
