# Three-stage Docker build for Cloud Run using `next start` + full production node_modules.
# Avoids broken Next.js standalone file tracing (incomplete `next` package / missing @swc/helpers).

FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Turbopack server chunks break production API routes; force webpack for the server bundle.
RUN npx next build --webpack && \
  if find .next/server -name '*turbopack*' 2>/dev/null | grep -q .; then \
    echo "ERROR: Turbopack artifacts under .next/server — webpack build required."; \
    find .next/server -name '*turbopack*' | head -20; \
    exit 1; \
  fi

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

RUN npm ci --omit=dev && node -e "require('next'); console.log('next ok')"

EXPOSE 8080

# Cloud Run sets PORT; default 8080 for local docker run.
CMD ["sh", "-c", "exec npx next start -p \"${PORT:-8080}\""]
