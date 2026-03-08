const mongoose = require('mongoose');

const trainingDataSchema = new mongoose.Schema({
    // Location & Time
    timestamp: { type: Date, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    elevation: { type: Number, default: 50 },
    isUrban: { type: Boolean, default: false },

    // 12 Atmospheric Input Features (for ML model)
    inputs: {
        seeing: Number,           // arcseconds (USP output)
        transparency: Number,     // 0-8 scale
        cloudScore: Number,       // 0-8 scale (blended)
        wind: Number,             // m/s surface wind
        jetStream: Number,        // m/s 250hPa
        cape: Number,             // J/kg convective energy
        humidity: Number,         // % RH2m
        temp: Number,             // °C
        pm25: Number,             // μg/m³ (null if unavailable)
        aod: Number,              // aerosol optical depth (null if unavailable)
        moonPhase: Number,        // 0-1 lunation cycle
        moonFraction: Number,     // 0-1 illumination
    },

    // 3-Layer Cloud Detail
    layers: {
        cloudLow: Number,         // 0-100% or null
        cloudMid: Number,
        cloudHigh: Number,
    },

    // Model Predictions (what WARP AI predicted)
    predicted: {
        score: Number,            // 0-100 observation score
        grade: String,            // S/A/B/C/D
        uspSeeing: Number,        // arcseconds
        uspConfidence: Number,    // 0-100%
        r0: Number,               // Fried parameter (cm)
    },

    // API Source Health (which APIs contributed)
    apiSources: {
        timer: Boolean,
        openmeteo: Boolean,
        metno: Boolean,
        kma: Boolean,
        ensemble: Boolean,
        metar: Boolean,
        airquality: Boolean,
    },

    // User Feedback (filled later via /api/feedback)
    actual: {
        rating: { type: Number, min: 1, max: 5 },  // 1=terrible, 5=excellent
        actualSeeing: Number,                        // arcseconds (optional)
        comment: String,
        feedbackAt: Date,
    },
}, {
    timestamps: true,
});

// Compound index for finding matching predictions for feedback
trainingDataSchema.index({ lat: 1, lon: 1, timestamp: 1 });
// TTL-free: keep all data for training

module.exports = mongoose.model('TrainingData', trainingDataSchema);
