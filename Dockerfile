# syntax=docker/dockerfile:1.4
# ==========================================
# Stage 1: Base image with pnpm & libc6-compat
# ==========================================
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat wget
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

# ==========================================
# Stage 2: Dependencies installation
# ==========================================
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prefer-offline

# ==========================================
# Stage 3: Source compilation & Next.js standalone build
# ==========================================
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Set build-time variables required for Next.js build compilation
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# Tooling image for one-shot migrations; never exposed as the web service.
FROM builder AS tools
RUN apk add --no-cache postgresql-client tar

# ==========================================
# Stage 4: Production minimal runner
# ==========================================
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install runtime utilities (wget for healthcheck)
RUN apk add --no-cache wget

# Create unprivileged system user and group (UID 1001)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create uploads storage mount point outside web root with strict permissions
RUN mkdir -p /data/uploads && \
    chown -R nextjs:nodejs /data/uploads && \
    chmod 750 /data/uploads

# Copy public assets and Next.js standalone bundle
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Container healthcheck querying internal healthcheck route
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start standalone Next.js server
CMD ["node", "server.js"]
