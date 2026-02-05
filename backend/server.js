console.log("Starting Server...");
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Database Connection String
const MONGODB_URI = process.env.MONGODB_URI;

// Import Controllers
const weatherController = require('./controllers/weatherController');

// Import Models
require('./models/User');
require('./models/WeatherData');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

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

// --- API Routes ---
app.get('/api/weather', weatherController.getWeatherAndSeeing);

// Register CLS routes
const clsRoutes = require('./routes/cls');
app.use('/api/cls', clsRoutes);

// --- Static Asset Serving (Production) ---
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '../frontend/dist');

    // 1. Serve static files normally
    app.use(express.static(distPath));

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
