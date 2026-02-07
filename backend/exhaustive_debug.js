const ProviderService = require('./services/providerService');
const WeatherService = require('./services/weatherService');
const USPModel = require('./services/USPModel');
const ScoringService = require('./services/scoringService');
const AnalysisService = require('./services/analysisService');
require('dotenv').config();

async function runExhaustiveDebug() {
    console.log("=========================================");
    console.log("   SYSTEMIC DEBUGGING & VALIDATION       ");
    console.log("=========================================\n");

    const lat = 37.5665; // Seoul
    const lon = 126.9780;

    // 1. Data Provider Latency & Health Check
    console.log("[1/4] Provider Health Check...");
    const start = Date.now();
    try {
        const [timer, om, met, aq] = await Promise.all([
            ProviderService.fetch7Timer(lat, lon),
            ProviderService.fetchOpenMeteo(lat, lon, ['best_match', 'gfs_seamless', 'ecmwf_ifs']),
            ProviderService.fetchMetNo(lat, lon),
            ProviderService.fetchAirQuality(lat, lon)
        ]);

        console.log(`- Time: ${Date.now() - start}ms`);
        console.log(`- 7Timer: ${timer ? 'OK' : 'FAIL'}`);
        console.log(`- Open-Meteo: ${om ? 'OK' : 'FAIL (Expected in some envs)'}`);
        console.log(`- Met.no: ${met ? 'OK' : 'FAIL'}`);
        console.log(`- Air Quality: ${aq ? 'OK' : 'FAIL'}`);
    } catch (e) {
        console.error("Provider Health Critical Error:", e.message);
    }

    // 2. Mathematical Stability Audit (USP-Model)
    console.log("\n[2/4] Mathematical Stability Audit (Extreme Scenarios)...");

    const scenarios = [
        { name: "Perfect Night", wind: 0, humidity: 40, tempVar: 0, aod: 0.05, pm25: 5 },
        { name: "Storm Scenario", wind: 25, humidity: 95, tempVar: 10, aod: 0.5, pm25: 100 },
        { name: "Zero Ground", wind: 0, humidity: 0, tempVar: 0, aod: 0, pm25: 0 }
    ];

    scenarios.forEach(scen => {
        const res = USPModel.calculate({
            layers: [],
            surfaceWind: scen.wind,
            jetStreamSpeed: scen.wind * 2,
            targetAltitude: 90,
            humidity: scen.humidity,
            variance: scen.tempVar,
            aod: scen.aod,
            pm25: scen.pm25
        });

        const isStable = !isNaN(res.seeing) && !isNaN(res.score) && res.seeing > 0;
        console.log(`- [${scen.name}] Seeing: ${res.seeing}", Score: ${res.score}, Stable: ${isStable ? 'YES' : 'NO'}`);
    });

    // 3. Data Blending Integrity
    console.log("\n[3/4] Data Blending Integrity Check...");
    try {
        const result = await WeatherService.getAggregatedForecast(lat, lon);
        const sample = result.forecast[0];

        const fields = ['temp2m', 'rh2m', 'scores', 'usp', 'score', 'time'];
        const missing = fields.filter(f => sample[f] === undefined || sample[f] === null || (typeof sample[f] === 'number' && isNaN(sample[f])));

        if (missing.length === 0) {
            console.log("- All critical data fields are PRESENT and VALID.");
            console.log(`- Sample USP Confidence: ${sample.usp.confidence}%`);
            console.log(`- Sources Used Meta: ${result.meta.sources}`);
        } else {
            console.error(`- MISSING/INVALID FIELDS: ${missing.join(', ')}`);
        }
    } catch (e) {
        console.error("- Blending Critical Error:", e.message);
    }

    // 4. AI Inference Logic Review
    console.log("\n[4/4] AI Inference Logic Preview...");
    if (process.env.GEMINI_API_KEY) {
        try {
            const result = await WeatherService.getAggregatedForecast(lat, lon);
            console.log(`- AI Insight Generated: ${result.aiSummary ? 'YES' : 'NO'}`);
            if (result.aiSummary) {
                console.log(`- Snippet: "${result.aiSummary.substring(0, 100)}..."`);
            }
        } catch (e) {
            console.error("- AI Service Critical Error:", e.message);
        }
    } else {
        console.log("- AI Review SKIPPED: GEMINI_API_KEY not found.");
    }

    console.log("\n=========================================");
    console.log("   DEBUGGING COMPLETE                    ");
    console.log("=========================================");
}

runExhaustiveDebug();
