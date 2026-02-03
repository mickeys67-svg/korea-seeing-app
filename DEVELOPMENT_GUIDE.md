# Korea Sky Seeing App - Development & Deployment Guide 📘

## Project Structure
This project is set up as a monorepo with separate `backend` and `frontend` directories, but managed from the `root` for deployment.

- `root/`: Deployment scripts and configs.
- `backend/`: Node.js/Express server (API + Static File Serving).
- `frontend/`: React + Vite + TypeScript application.

## 🚀 Deployment (Render)

### Configuration
- **Build Command:** `npm run render-build`
    - This script installs dependencies for root, backend, and frontend, then builds the frontend.
- **Start Command:** `cd backend && npm start`
    - **CRITICAL:** Must switch to `backend` directory to ensure `server.js` finds modules and `.env` correctly.
- **Environment Variables:**
    - `MONGODB_URI`: Connection string for MongoDB Atlas.
    - `NODE_ENV`: Set to `production`.

### ⚠️ Critical Implementation Details (Do Not Change Without Caution)

#### 1. Express 5 Routing
The project uses **Express v5 (Beta)**.
- **Wildcard Routes:** The standard `*` syntax is **NOT supported**.
- **Correct Syntax:** Use `app.get(/(.*)/, ...)` for the SPA fallback route.
- Changing this back to `*` will cause the server to crash with `PathError`.

#### 2. Dependency Management
- **Production Build:** Render's production environment often ignores `devDependencies`.
- **Frontend Build Tools:** Tools like `vite`, `typescript`, `tailwindcss` MUST be in `dependencies` (not `devDeps`) in `frontend/package.json` to ensure the build succeeds on the server.

#### 3. Frontend-Backend Integration
- The backend serves static files from `../frontend/dist`.
- `server.js` must be run with the assumption that `frontend/dist` exists (created by build command).

## 🛠 Troubleshooting

| Error | Probable Cause | Fix |
|-------|----------------|-----|
| `exited with status 1` | `npm start` running from wrong directory or missing modules. | Ensure Start Command is `cd backend && npm start`. |
| `PathError: Missing parameter name...` | Express 5 Wildcard syntax. | Use `/(.*)/` instead of `*`. |
| `vite: command not found` | Build tools in `devDependencies`. | Move `vite` to `dependencies` in `frontend/package.json`. |

## 📦 Scripts
- `npm run render-build`: Full install and build for deployment.
- `npm start` (Root): Runs backend server (Production mode).
- `npm run client` (Root): Runs frontend dev server.
