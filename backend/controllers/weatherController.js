const WeatherService = require('../services/weatherService');
const AstronomyService = require('../services/astronomyService');

exports.getWeatherAndSeeing = async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and Longitude are required' });
        }

        // 1. Get Aggregated Weather Data (7Timer + OpenMeteo + MetNo)
        console.log('Fetching aggregated forecast for', lat, lon);
        const processedSeeing = await WeatherService.getAggregatedForecast(lat, lon);
        console.log('Processed seeing count:', processedSeeing ? processedSeeing.length : 'null');

        // Astronomy Data (Moon & Sun for 3 days)
        // Use the first forecast time as start date, or current date
        const startDate = (processedSeeing && processedSeeing.length > 0) ? new Date(processedSeeing[0].time) : new Date();
        console.log('Astronomy start date:', startDate);

        const astronomy = AstronomyService.getAstronomyForecast(startDate, 3, lat, lon);
        console.log('Astronomy data generated');

        res.json({
            location: { lat, lon },
            forecast: processedSeeing || [],
            astronomy: astronomy
        });

    } catch (error) {
        console.error('API Error Stack:', error.stack);
        res.status(500).json({ error: 'Failed to fetch weather data: ' + error.message });
    }
};
