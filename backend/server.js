console.log("Starting Server...");
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/korea_sky_seeing';

if (!process.env.MONGODB_URI && process.env.NODE_ENV === 'production') {
    console.warn('WARNING: MONGODB_URI is not set in production environment!');
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

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

    // 2. Middleware Catch-all for SPA (Instead of app.get('*'))
    // This is the most robust way in Express 5 to avoid PathError
    app.use((req, res, next) => {
        // Only serve index.html for GET requests that aren't API calls
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            // FORCE NO-CACHE for index.html entry point
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.sendFile(path.join(distPath, 'index.html'));
        } else {
            next();
        }
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
