const axios = require('axios');

const ProviderService = {
    // 1. 7Timer! (Astro)
    async fetch7Timer(lat, lon) {
        try {
            const url = `http://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=astro&output=json`;
            const response = await axios.get(url, { timeout: 5000 });
            return response.data;
        } catch (error) {
            console.error('7Timer fetch failed:', error.message);
            return null;
        }
    },

    // 2. Open-Meteo
    async fetchOpenMeteo(lat, lon) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,wind_speed_250hPa,cape&forecast_days=3&timezone=auto`;
            const response = await axios.get(url, { timeout: 5000 });
            return response.data;
        } catch (error) {
            console.error('Open-Meteo fetch failed:', error.message);
            return null;
        }
    },

    // 3. Met.no (require User-Agent)
    async fetchMetNo(lat, lon) {
        try {
            const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'KoreaSkySeeing/1.0 (mickey@example.com)' // Replace with generic or real contact
                },
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            console.error('Met.no fetch failed:', error.message);
            return null;
        }
    }
};

module.exports = ProviderService;
