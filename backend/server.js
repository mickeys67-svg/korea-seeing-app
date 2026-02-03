console.log("Starting Server...");
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import Services
const WeatherService = require('./services/weatherService');
const AstronomyService = require('./services/astronomyService');

// Import Models
require('./models/User');
require('./models/WeatherData');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/korea_sky_seeing';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Routes
app.get('/', (req, res) => {
    res.send('Korea Sky Seeing API is running...');
});

// API Endpoint: Get Weather & Seeing
app.get('/api/weather', async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and Longitude are required' });
        }

        // 1. Get Seeing Data (7Timer)
        const rawSeeing = await WeatherService.getSeeingData(lat, lon);
        const processedSeeing = WeatherService.processSeeingData(rawSeeing.dataseries);

        // 2. Get Moon Data
        const moonData = AstronomyService.getMoonData(new Date(), lat, lon);
        const moonPhaseName = AstronomyService.getMoonPhaseName(moonData.phase);

        res.json({
            location: { lat, lon },
            moon: { ...moonData, phaseName: moonPhaseName },
            forecast: processedSeeing
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});

// Serve Static Assets in Production
const path = require('path');
if (process.env.NODE_ENV === 'production') {
    // Set static folder
    app.use(express.static(path.join(__dirname, '../frontend/dist')));

    // Any other route loads the index.html (for React Router)
    app.get(/(.*)/, (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
