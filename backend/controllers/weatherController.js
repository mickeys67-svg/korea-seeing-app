const WeatherService = require('../services/weatherService');
const AstronomyService = require('../services/astronomyService');
const TranslationService = require('../services/translationService');

exports.getWeatherAndSeeing = async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and Longitude are required' });
        }

        // 1. Get Aggregated Weather Data
        console.log('Fetching aggregated forecast for', lat, lon);
        let processedSeeing = await WeatherService.getAggregatedForecast(lat, lon);

        // 2. Determine and Apply AI Translation
        // Heuristic: If in Korea (lat: 33-39, lon: 124-132) or explicitly requested
        let targetLang = req.query.lang || 'en';
        if (!req.query.lang && (lat >= 33 && lat <= 39) && (lon >= 124 && lon <= 132)) {
            targetLang = 'ko';
        }

        if (targetLang !== 'en' && processedSeeing && processedSeeing.length > 0) {
            console.log(`[Translation] Applying AI translation to ${targetLang}...`);
            processedSeeing = await TranslationService.translateForecastBatch(processedSeeing, targetLang);
        }

        // 3. Astronomy Data (Moon & Sun for 3 days)
        const startDate = (processedSeeing && processedSeeing.length > 0) ? new Date(processedSeeing[0].time) : new Date();
        const astronomy = AstronomyService.getAstronomyForecast(startDate, 3, lat, lon);

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
