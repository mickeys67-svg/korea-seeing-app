console.log("Starting Server...");
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Database Connection String
const MONGODB_URI = process.env.MONGODB_URI;

// Import Controllers
const weatherController = require('./controllers/weatherController');

// Import Models
require('./models/TrainingData');

const app = express();
const PORT = process.env.PORT || 8080;

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline styles/scripts for SPA
    crossOriginEmbedderPolicy: false,
}));

// Rate limiting for API routes
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// Middleware
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['https://www.clearsky.kr', 'https://clearsky.kr', 'http://localhost:5173'];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
app.use(express.json({ limit: '50kb' }));

// Database Connection
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000, // Fail fast for health checks
        connectTimeoutMS: 10000
    })
        .then(() => console.log('MongoDB Connected'))
        .catch(err => {
            console.error('MongoDB Connection Error:', err.message);
            // Don't exit here, still serve static files if possible (or fail health check)
        });
}

// --- Health Check (for Cloud Run / Load Balancers) ---
app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState; // 0=disconnected, 1=connected, 2=connecting
    res.status(dbState === 1 || !MONGODB_URI ? 200 : 503).json({
        status: dbState === 1 || !MONGODB_URI ? 'ok' : 'degraded',
        uptime: Math.round(process.uptime()),
        db: MONGODB_URI ? (dbState === 1 ? 'connected' : 'disconnected') : 'not configured',
    });
});

// --- API Routes ---
app.get('/api/weather', weatherController.getWeatherAndSeeing);

// Register CLS routes
const clsRoutes = require('./routes/cls');
app.use('/api/cls', clsRoutes);

// Register Feedback routes
const feedbackRoutes = require('./routes/feedback');
app.use('/api', feedbackRoutes);

// --- Static Asset Serving (Production) ---
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '../frontend/dist');

    // 1. Serve static files — HTML no-cache, assets immutable (hashed filenames)
    app.use(express.static(distPath, {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
        }
    }));

    // 2. Catch-all for SPA - Must be the LAST route
    // Use regex to avoid string parsing issues in Express 5
    app.get(/.*/, (req, res) => {
        // Safe check for URL - Only serve index.html for non-API GET requests
        const url = req.originalUrl || req.url || '';
        if (req.method === 'GET' && !url.startsWith('/api')) {
            // FORCE NO-CACHE for index.html entry point
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            const indexPath = path.join(distPath, 'index.html');
            return res.sendFile(indexPath, (err) => {
                if (err) {
                    console.error(`Error sending index.html from ${indexPath}:`, err.message);
                    if (!res.headersSent) {
                        res.status(500).send('Frontend build not found.');
                    }
                }
            });
        }

        // If not a GET or is an API route that reached here, 404
        res.status(404).json({ error: 'Route not found' });
    });
} else {
    // Basic fallback for development if someone hits a non-existent route
    app.get('/', (req, res) => {
        res.send('Korea Sky Seeing API is running. (Development Mode - Please run frontend separately)');
    });
}

// --- Global Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
