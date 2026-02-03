# Use Node.js 20 on Alpine Linux for a small footprint
FROM node:20-alpine

# Set working directory for the app
WORKDIR /app

# Copy root package files if any (mainly for reference, though detailed install happens in subfolders)
COPY package*.json ./

# --- Frontend Build Stage ---
# Copy frontend package files
COPY frontend/package*.json ./frontend/
# Install frontend dependencies
WORKDIR /app/frontend
RUN npm install

# Copy frontend source code
COPY frontend/ ./
# Build the frontend (outputs to /app/frontend/dist)
RUN npm run build

# --- Backend Setup Stage ---
WORKDIR /app/backend
# Copy backend package files
COPY backend/package*.json ./
# Install backend dependencies (production only to save space)
RUN npm install --production

# Copy backend source code
COPY backend/ ./

# --- Final Assembly ---
WORKDIR /app
# We need to make sure the backend can find the frontend/dist folder.
# The structure inside the container will be:
# /app/backend
# /app/frontend/dist

# Expose port (Cloud Run sets PORT env var, but 8080 is standard default)
ENV PORT=8080
EXPOSE 8080

# Start the server using the backend's start script
# We need to run from the root or adjust paths. 
# Based on project root package.json, "start" is "cd backend && npm start"
# But we are inside the container. Let's simplify and run directly from backend.
WORKDIR /app/backend
CMD ["npm", "start"]
