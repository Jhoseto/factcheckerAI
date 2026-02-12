# Use official Node.js image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files  
COPY package*.json ./

# Install ONLY production dependencies
RUN npm install --production

# Copy pre-built dist folder, server, and services
COPY dist ./dist
COPY server.js ./
COPY services ./services
COPY firebase-service-account.json ./

# Expose the port
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
