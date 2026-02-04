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
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/korea_sky_seeing';

// Only warn if in production and URI is missing (using fallback localhost might be intended for dev)
if (!process.env.MONGODB_URI && process.env.NODE_ENV === 'production') {
    console.warn('WARNING: MONGODB_URI is not set in production environment!');
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Routes
// In production, the root route is handled by serving client/dist/index.html via the catch-all below.
// app.get('/', (req, res) => {
//     res.send('Korea Sky Seeing API is running...');
// });

// API Endpoint
app.get('/api/weather', weatherController.getWeatherAndSeeing);

// Serve Static Assets in Production
if (process.env.NODE_ENV === 'production') {
    // Set static folder
    app.use(express.static(path.join(__dirname, '../frontend/dist')));

    // Any other route loads the index.html (for React Router)
    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
