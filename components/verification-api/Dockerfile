FROM node:20-slim

WORKDIR /app

# Install native build tools needed by better-sqlite3 (node-gyp)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Run as a non-root user for container isolation
RUN addgroup --system --gid 1001 nodeapp \
 && adduser  --system --uid 1001 --ingroup nodeapp --no-create-home nodeapp \
 && chown -R nodeapp:nodeapp /app
USER nodeapp

CMD ["node", "src/server.js"]
