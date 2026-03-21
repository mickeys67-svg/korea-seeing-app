const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Load city data asynchronously
const citiesPath = path.join(__dirname, '../data/cities.json');
let cities = [];

let citiesLoaded = false;
const loadCities = async () => {
    try {
        const data = await fs.promises.readFile(citiesPath, 'utf8');
        cities = JSON.parse(data);
        citiesLoaded = true;
        console.log('[CLS] Cities data loaded successfully');
    } catch (err) {
        console.error('[CLS] Error loading cities.json:', err);
    }
};
loadCities();

/**
 * GET /api/cls/cities/search?q=query&limit=num
 * Search cities by name (KR/EN) or country (KR/EN)
 */
router.get('/cities/search', (req, res) => {
    if (!citiesLoaded) {
        return res.status(503).json({ error: 'City data is still loading. Please try again.' });
    }

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
        .slice(0, Math.min(50, Math.max(1, parseInt(limit, 10) || 10)))
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

module.exports = router;
