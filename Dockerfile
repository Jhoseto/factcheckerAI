# Use official Node.js image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files  
COPY package*.json ./

# Install ONLY production dependencies
RUN npm install --production --legacy-peer-deps

# Copy pre-built dist folder, server, and locales (for /api/translate)
COPY dist ./dist
COPY server ./server
COPY locales ./locales

# Expose the port
EXPOSE 8080

# Start the server
CMD ["node", "server/index.js"]
