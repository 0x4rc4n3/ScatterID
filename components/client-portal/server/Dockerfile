# ScatterID Client Portal Gateway Dockerfile
# Hardened Multi-Stage Distroless Build powered by Chainguard
# Base: cgr.dev/chainguard/node (minimal attack surface, non-root uid 65532)

FROM cgr.dev/chainguard/node:latest-dev AS builder
USER root
WORKDIR /app

# Install dependencies using non-root cache
COPY --chown=node:node package*.json tsconfig.json ./
USER node
RUN npm ci

# Compile TypeScript and prune dev dependencies
COPY --chown=node:node src ./src
RUN npm run build && npm prune --omit=dev

# Final Stage: Chainguard Distroless Minimal Runtime
FROM cgr.dev/chainguard/node:latest
WORKDIR /app

# Copy production artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=5000

# Chainguard non-root default user (uid 65532)
USER 65532
EXPOSE 5000

CMD ["dist/server.js"]
