const WeatherService = require('../services/weatherService');
const AstronomyService = require('../services/astronomyService');
const TranslationService = require('../services/translationService');

exports.getWeatherAndSeeing = async (req, res, next) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'Valid Latitude and Longitude are required' });
        }

        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({ error: 'Latitude must be between -90 and 90, Longitude between -180 and 180' });
        }

        // 1. Determine language BEFORE fetching data (needed by analysisService)
        const ALLOWED_LANGS = ['en', 'ko', 'ja', 'zh'];
        let targetLang = ALLOWED_LANGS.includes(req.query.lang) ? req.query.lang : 'en';
        if (!req.query.lang && (lat >= 33 && lat <= 39) && (lon >= 124 && lon <= 131)) {
            targetLang = 'ko';
        } else if (!req.query.lang && (lat >= 24 && lat <= 46) && (lon >= 127 && lon <= 146) && targetLang === 'en') {
            targetLang = 'ja';
        }

        // 2. Get Aggregated Weather Data (pass targetLang for aiSummary language)
        // v5.4 비용0원: 요청당 로그 제거 (production)
        const { forecast, aiSummary, meta } = await WeatherService.getAggregatedForecast(lat, lon, targetLang);
        let processedSeeing = forecast;

        // 3. Apply Translation to forecast recommendations
        if (targetLang !== 'en' && processedSeeing && processedSeeing.length > 0) {
            processedSeeing = TranslationService.translateForecastBatch(processedSeeing, targetLang);
        }

        // 4. Astronomy Data (Moon & Sun for 4 days) — pass timezone offset for correct local dates
        //    4th day is a buffer so the last displayed day (day 3) has nextDay moon data
        //    for accurate observation window calculation (moonrise/set after midnight)
        const startDate = (processedSeeing && processedSeeing.length > 0) ? new Date(processedSeeing[0].time) : new Date();
        const utcOffset = meta ? meta.timezoneOffset : 0;
        const astronomy = AstronomyService.getAstronomyForecast(startDate, 4, lat, lon, utcOffset);

        // v5.4 비용0원: 10분 브라우저 캐시 + 30분 stale-while-revalidate (서버 도달 요청 ~70%↓)
        res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=1800');
        res.json({
            location: {
                lat,
                lon,
                timezone: meta ? meta.timezone : 'UTC',
                timezoneOffset: meta ? meta.timezoneOffset : 0
            },
            forecast: processedSeeing || [],
            aiSummary: aiSummary || null,
            astronomy: astronomy,
            apiHealth: meta?.apiHealth ?? null
        });

    } catch (error) {
        next(error);
    }
};
