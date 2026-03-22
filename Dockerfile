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

# Build the application (creates .next/standalone)
RUN npm run build

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
