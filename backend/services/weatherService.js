const axios = require('axios');

const WeatherService = {
    // Fetch from 7Timer! ASTRO API
    getSeeingData: async (lat, lon) => {
        try {
            // 7Timer! Astro API
            // Product: astro, output: json
            const url = `http://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=astro&output=json`;
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching seeing data:', error);
            throw error;
        }
    },

    // Process 7Timer data into user friendly format
    processSeeingData: (dataseries) => {
        if (!dataseries || dataseries.length === 0) return null;

        // Mapping 7Timer values to meaningful descriptions
        // Seeing: 1 ( <0.5" ) to 8 ( >2.5" ) - Lower is better usually, but 7Timer scale:
        // 1: <0.5 arcsec (Perfect), 8: >2.5 arcsec (Poor)

        // Transparency: 1 ( <0.3 mag ) to 8 ( >1.0 mag ) - Lower is better.

        return dataseries.map(item => ({
            timepoint: item.timepoint, // Hours from now
            cloudCover: item.cloudcover, // 1-9
            seeing: item.seeing, // 1-8
            transparency: item.transparency, // 1-8
            liftedIndex: item.lifted_index,
            rh2m: item.rh2m, // Relative humidity
            wind10m: item.wind10m, // Wind speed info
            temp2m: item.temp2m // Temperature
        }));
    }
};

module.exports = WeatherService;
