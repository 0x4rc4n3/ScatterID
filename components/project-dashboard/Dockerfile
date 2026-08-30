# Stage 1: Build the TypeScript SDK
FROM node:20-slim AS sdk-builder
WORKDIR /sdk
COPY sdk/package*.json ./
RUN npm install
COPY sdk/ ./
RUN npm run build

# Stage 2: Dashboard runtime
FROM node:20-slim
WORKDIR /app

# Copy dashboard package files and install dependencies
COPY components/project-dashboard/package*.json ./
RUN npm install

# Copy compiled SDK into /app/sdk
COPY --from=sdk-builder /sdk /app/sdk

# Copy dashboard source code
COPY components/project-dashboard/ .

EXPOSE 4000

# Run as non-root user
RUN addgroup --system --gid 1001 nodeapp \
 && adduser  --system --uid 1001 --ingroup nodeapp --no-create-home nodeapp \
 && chown -R nodeapp:nodeapp /app
USER nodeapp

CMD ["npm", "start"]
