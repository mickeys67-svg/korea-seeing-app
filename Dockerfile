# Base image
FROM node:20-alpine

WORKDIR /app

# Copy ALL files (respected by .dockerignore)
COPY . .

# --- Frontend Build ---
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# --- Backend Setup ---
WORKDIR /app/backend
RUN npm install --production

# --- Final Config ---
WORKDIR /app
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Start
WORKDIR /app/backend
CMD ["npm", "start"]
