# Multi-stage build for Next.js application
# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build with webpack only. Turbopack server output breaks standalone at runtime on Cloud Run
# (missing next-server/app-route-turbo.runtime.prod.js). Do not rely on npm script alone in CI.
RUN npx next build --webpack && \
  if find .next/server -name '*turbopack*' 2>/dev/null | grep -q .; then \
    echo "ERROR: Turbopack artifacts under .next/server — webpack build required."; \
    find .next/server -name '*turbopack*' | head -20; \
    exit 1; \
  fi

# Replace the incomplete next package that file tracing produces with the full one.
# BusyBox `cp -r` into an existing `next` dir can nest as `next/next` and break resolution.
RUN rm -rf /app/.next/standalone/node_modules/next && \
  cp -r /app/node_modules/next /app/.next/standalone/node_modules/next && \
  test -f /app/.next/standalone/node_modules/next/package.json && \
  mkdir -p /tmp/cr-runtime-test && cp -a /app/.next/standalone/. /tmp/cr-runtime-test/ && \
  cd /tmp/cr-runtime-test && node -e "require('next'); console.log('next isolate ok')" && \
  rm -rf /tmp/cr-runtime-test

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

RUN node -e "require('next'); console.log('runtime image: next ok')"

# Set environment for production
ENV NODE_ENV=production

# Expose port (Cloud Run sets PORT env var, default 8080)
EXPOSE 8080

# Start the application
# Next.js in standalone mode respects the PORT environment variable
CMD ["node", "server.js"]
