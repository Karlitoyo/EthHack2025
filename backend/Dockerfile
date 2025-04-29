# Stage 1: Build the NestJS application
FROM node:20.17.0 AS build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json from the backend directory
COPY backend/package*.json ./

# Install dependencies
RUN npm install

# Copy the backend source code from the backend directory
COPY backend/. ./

# Copy the ABI files into the backend source structure
COPY ethereum/src/abi /app/abi

# Expose the port that the NestJS app runs on
EXPOSE 4001

# Install the development tools for hot reloading
RUN npm install --save-dev @nestjs/cli

# Command to run the application
CMD ["npm", "run", "start:dev"]