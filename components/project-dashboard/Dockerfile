FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the dashboard source code
COPY . .

EXPOSE 4000

# Run as a non-root user for container isolation.
# docker.io is intentionally NOT installed — the dashboard no longer uses the
# Docker socket (removed in prior security pass). There is no Docker CLI here
# by design; use `docker logs <container>` from the host instead.
RUN addgroup --system --gid 1001 nodeapp \
 && adduser  --system --uid 1001 --ingroup nodeapp --no-create-home nodeapp
USER nodeapp

CMD ["npm", "start"]
