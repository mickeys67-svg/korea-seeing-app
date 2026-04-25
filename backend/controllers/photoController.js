/**
 * v5.0 Photo Guide — Controller
 *
 * GET /api/photo-forecast?lat=..&lon=..&lang=en|ko|ja|zh
 *
 * 기존 weatherController와 완전 분리.
 * 오류 발생 시에도 /api/weather 에 영향 0.
 */
const PhotoService = require('../services/photo/photoService');

exports.getPhotoForecast = async (req, res, next) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'Valid Latitude and Longitude are required' });
        }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({ error: 'Latitude must be between -90 and 90, Longitude between -180 and 180' });
        }

        const ALLOWED_LANGS = ['en', 'ko', 'ja', 'zh'];
        let targetLang = ALLOWED_LANGS.includes(req.query.lang) ? req.query.lang : 'en';
        // 언어 auto-inference (좌표 기반) — weatherController와 동일 정책
        if (!req.query.lang && (lat >= 33 && lat <= 39) && (lon >= 124 && lon <= 131)) {
            targetLang = 'ko';
        } else if (!req.query.lang && (lat >= 24 && lat <= 46) && (lon >= 127 && lon <= 146) && targetLang === 'en') {
            targetLang = 'ja';
        }

        // v5.4 비용0원: 요청당 로그 제거
        const result = await PhotoService.getPhotoForecast(lat, lon, targetLang);

        // v5.4 비용0원: 10분 fresh + 30분 stale-while-revalidate
        res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=1800');
        res.json(result);
    } catch (error) {
        console.error('[Photo] controller error:', error);
        next(error);
    }
};
