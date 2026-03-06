# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN npm install --production --legacy-peer-deps

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY admin ./admin
COPY chatBot ./chatBot
COPY locales ./locales

EXPOSE 8080
CMD ["node", "server/index.js"]
