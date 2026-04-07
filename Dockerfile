# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG CACHEBUST=1
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

# Non-root user for security
RUN addgroup -g 1001 appgroup && adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev

# Copy backend source
WORKDIR /app
COPY backend/ ./backend/

# Copy frontend build output
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy root files needed at runtime
COPY start_all.js web.js package.json ./

# Switch to non-root user
USER appuser

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

WORKDIR /app/backend
CMD ["npm", "start"]
