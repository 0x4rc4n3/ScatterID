FROM node:20

WORKDIR /app

RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the dashboard source code
COPY . .

EXPOSE 4000

# Assuming 'npm start' handles the dashboard execution
CMD ["npm", "start"]
