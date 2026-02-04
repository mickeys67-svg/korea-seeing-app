const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Load city data
const citiesPath = path.join(__dirname, '../data/cities.json');
let cities = [];
try {
    const data = fs.readFileSync(citiesPath, 'utf8');
    cities = JSON.parse(data);
} catch (err) {
    console.error('[CLS] Error loading cities.json:', err);
}

/**
 * GET /api/cls/cities/search?q=query&limit=num
 * Search cities by name (KR/EN) or country (KR/EN)
 */
router.get('/cities/search', (req, res) => {
    const { q, limit = 10, lang = 'ko' } = req.query;

    if (!q || q.length < 2) {
        return res.json([]);
    }

    const query = q.toLowerCase();

    // Filter logic with priority (prefix matches first)
    const results = cities
        .filter(city => {
            const nameMatch = city.name.toLowerCase().includes(query) ||
                city.nameEn.toLowerCase().includes(query);
            const countryMatch = city.country.toLowerCase().includes(query) ||
                city.countryEn.toLowerCase().includes(query);
            return nameMatch || countryMatch;
        })
        .sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            if (aName.startsWith(query) && !bName.startsWith(query)) return -1;
            if (!aName.startsWith(query) && bName.startsWith(query)) return 1;
            return 0;
        })
        .slice(0, parseInt(limit, 10))
        .map(city => ({
            id: city.id,
            name: city.name,
            nameEn: city.nameEn,
            country: city.country,
            lat: city.lat,
            lng: city.lng
        }));

    res.json(results);
});

/**
 * GET /api/cls/geocoding/reverse?lat=x&lng=y
 * Fallback to OpenStreetMap Nominatim for Reverse Geocoding
 */
router.get('/geocoding/reverse', async (req, res) => {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ error: 'Lat and Lng are required' });
    }

    try {
        // Note: In real production, use an API key or respect Nominatim's usage policy.
        // Here we use it as a simple proxy.
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ko`,
            {
                headers: {
                    'User-Agent': 'ClearSky-App/1.0'
                }
            }
        );

        if (!response.ok) throw new Error('Geocoding service unavailable');

        const data = await response.json();

        res.json({
            name: data.display_name.split(',')[0],
            address: data.display_name,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            source: 'gps'
        });
    } catch (err) {
        console.error('[CLS] Reverse Geocoding Error:', err);
        res.status(502).json({ error: 'Reverse geocoding failed' });
    }
});

module.exports = router;
