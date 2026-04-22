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

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Set environment for production
ENV NODE_ENV=production

# Expose port (Cloud Run sets PORT env var, default 8080)
EXPOSE 8080

# Start the application
# Next.js in standalone mode respects the PORT environment variable
CMD ["node", "server.js"]
