# ScatterID Verification API Dockerfile
# Hardened Multi-Stage Build: Compiles native C++ bindings in builder stage,
# stripping all compilers (gcc, make, python3) from the production image.

FROM node:20-slim AS builder

WORKDIR /app

# Install native build tools needed by better-sqlite3 and argon2
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Final Stage: Hardened Minimal Runtime (Zero build tools)
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy compiled native node_modules and application code
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Create non-root user and initialize persistent data volume with proper ownership
RUN addgroup --system --gid 1001 nodeapp \
 && adduser  --system --uid 1001 --ingroup nodeapp --no-create-home nodeapp \
 && mkdir -p /app/data \
 && chown -R nodeapp:nodeapp /app

USER nodeapp
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD node -e 'require("http").get("http://localhost:3000/healthz", (r) => process.exit(r.statusCode === 200 ? 0 : 1))' || exit 1

CMD ["node", "src/server.js"]
