const WeatherService = require('./services/weatherService');
const AnalysisService = require('./services/analysisService');
require('dotenv').config();

async function verifyEnsemble() {
    console.log("=== Ensemble USP Engine Verification ===");
    const lat = 37.5665; // Seoul
    const lon = 126.9780;

    try {
        console.log(`Fetching ensemble data for ${lat}, ${lon}...`);
        const result = await WeatherService.getAggregatedForecast(lat, lon);

        console.log("\n[Meta Info]");
        console.log(`- Timezone: ${result.meta.timezone}`);
        console.log(`- Data Sources: ${result.meta.sources.join(', ')}`);
        console.log(`- Top-level AI Summary: ${result.aiSummary || 'N/A'}`);

        console.log("\n[Forecast Sample - First Slot]");
        const first = result.forecast[0];
        console.log(`- Time: ${first.time}`);
        console.log(`- Integrated Seeing: ${first.usp.seeing}"`);
        console.log(`- USP Score: ${first.usp.score}/10`);
        console.log(`- Ensemble Confidence: ${first.usp.confidence}%`);
        console.log(`- Grade: ${first.grade}`);

        console.log("\n[Physics Check]");
        console.log(`- Jet Stream: ${first.raw.jetStreamSpeed} knots`);
        console.log(`- CAPE: ${first.raw.cape}`);
        console.log(`- Details:`, first.usp.details);

        if (result.aiSummary) {
            console.log("\n[Success] Ensemble engine and AI analysis are active.");
        } else {
            console.warn("\n[Warning] AI Summary missing. Check GEMINI_API_KEY.");
        }

    } catch (error) {
        console.error("Verification failed:", error);
    }
}

// Mocking environment if needed for the script
process.env.NODE_ENV = 'development';

verifyEnsemble();
