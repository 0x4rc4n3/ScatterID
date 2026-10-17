# ScatterID Operations Console Dockerfile
# Hardened Multi-Stage Build with non-root least-privilege execution

FROM node:20-alpine AS builder

WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache libstdc++
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
COPY db ./db
COPY public ./public

# Hardening: Run as non-root user and ensure db directory permissions
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
 && chown -R appuser:appgroup /app

USER appuser
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "src/server.js"]
