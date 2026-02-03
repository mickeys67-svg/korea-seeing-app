const mongoose = require('mongoose');

const WeatherDataSchema = new mongoose.Schema({
    location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number] // [longitude, latitude]
    },
    timestamp: { type: Date, required: true },
    source: { type: String, default: '7timer' }, // Data source

    // General Weather
    cloudCover: Number, // Percentage or 1-9 scale
    temperature: Number, // Celsius
    humidity: Number, // Percentage
    windSpeed: Number, // m/s

    // Astronomical Seeing Details
    seeing: Number, // 1 (Poor) - 5 (Excellent) or arcseconds
    transparency: Number, // Transparency of sky
    liftedIndex: Number, // Stability code

    // Moon Data (Calculated/Stored)
    moonPhase: Number, // 0.0 - 1.0
    moonIllumination: Number, // Percentage

    forecastData: [
        {
            time: Date,
            seeing: Number,
            cloudCover: Number
        }
    ]
}, { timestamps: true });

// Index for geospatial queries
WeatherDataSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('WeatherData', WeatherDataSchema);
