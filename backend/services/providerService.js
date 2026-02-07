const axios = require('axios');

const ProviderService = {
    // 1. 7Timer! (Astro) - Naturally covers ~8 days
    async fetch7Timer(lat, lon) {
        try {
            const url = `http://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=astro&output=json`;
            const response = await axios.get(url, { timeout: 10000 });
            return response.data;
        } catch (error) {
            console.error('7Timer fetch failed:', error.message);
            return null;
        }
    },

    // 2. Open-Meteo (Standard + Ensemble Support, Extended to 7 days)
    async fetchOpenMeteo(lat, lon, models = null) {
        try {
            const vars = [
                'temperature_2m', 'relative_humidity_2m', 'cloud_cover',
                'wind_speed_10m', 'wind_speed_250hPa', 'cape',
                'boundary_layer_height', 'skin_temperature'
            ].join(',');

            let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${vars}&forecast_days=7&timezone=auto`;

            if (models && models !== 'best_match') {
                url += `&models=${Array.isArray(models) ? models.join(',') : models}`;
            }

            const response = await axios.get(url, { timeout: 15000 });
            return response.data;
        } catch (error) {
            console.error(`Open-Meteo fetch failed:`, error.message);
            return null;
        }
    },

    // 3. Met.no (Slightly shorter range, but good for local correction)
    async fetchMetNo(lat, lon) {
        try {
            const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'KoreaSkySeeing/1.0 (mickey@example.com)'
                },
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            console.error('Met.no fetch failed:', error.message);
            return null;
        }
    },

    // 4. Open-Meteo Air Quality (Extended to 7 days)
    async fetchAirQuality(lat, lon) {
        try {
            const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,aerosol_optical_depth_550nm&forecast_days=7&timezone=auto`;
            const response = await axios.get(url, { timeout: 15000 });
            return response.data;
        } catch (error) {
            console.error(`Air Quality fetch failed:`, error.message);
            return null;
        }
    }
};

module.exports = ProviderService;
