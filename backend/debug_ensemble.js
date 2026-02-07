const WeatherService = require('./services/weatherService');
require('dotenv').config();

async function debugEnsemble() {
    console.log("1. Starting debug script...");
    const lat = 37.5665;
    const lon = 126.9780;

    try {
        console.log("2. Calling WeatherService.getAggregatedForecast...");
        const result = await WeatherService.getAggregatedForecast(lat, lon);
        console.log("3. Call successful!");

        console.log("\n[Meta Info]");
        console.log(`- Data Sources: ${result.meta.sources.join(', ')}`);
        console.log(`- AI Summary Length: ${result.aiSummary ? result.aiSummary.length : 0}`);

        if (result.forecast && result.forecast.length > 0) {
            console.log("\n[Data Sample]");
            console.log(`- Time: ${result.forecast[0].time}`);
            console.log(`- Seeing: ${result.forecast[0].usp.seeing}"`);
        }

    } catch (error) {
        console.error("DEBUG ERROR:", error.message);
        console.error(error.stack);
    }
}

debugEnsemble();
