const WeatherService = require('../services/weatherService');
const AstronomyService = require('../services/astronomyService');

exports.getWeatherAndSeeing = async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and Longitude are required' });
        }

        // 1. Get Aggregated Weather Data (7Timer + OpenMeteo + MetNo)
        const processedSeeing = await WeatherService.getAggregatedForecast(lat, lon);

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
};
