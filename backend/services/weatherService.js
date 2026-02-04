const ProviderService = require('./providerService');

const WeatherService = {
    // === SCORING HELPERS (0 = Best, 8 = Worst) ===

    // Jet Stream Score: Based on 250hPa Wind Speed (knots)
    // Using simplified "overhead" approach since we don't have distance map yet.
    calculateJetStreamScore: (speedMs) => {
        if (speedMs == null) return 8; // Unknown = assume worst? or neutral? Using worst for safety.
        const speedKt = speedMs * 1.94384; // m/s to knots

        let speedScore = 0;
        if (speedKt < 50) speedScore = 0;
        else if (speedKt < 80) speedScore = 2;
        else if (speedKt < 120) speedScore = 4;
        else if (speedKt < 150) speedScore = 6;
        else speedScore = 8;

        // Distance factor currently 1.0 (overhead)
        return speedScore;
    },

    // Convection Score: Based on CAPE and Time of Day
    calculateConvectionScore: (cape, hour) => {
        if (cape == null) return 0; // Assume stable if no data

        let baseScore = 0;
        if (cape < 100) baseScore = 0;
        else if (cape < 500) baseScore = 2;
        else if (cape < 1000) baseScore = 4;
        else if (cape < 2000) baseScore = 6;
        else baseScore = 8;

        // Time factor
        let timeFactor = 1.0;
        if (hour >= 20 && hour <= 23) timeFactor = 0.7; // Stabilization
        else if (hour >= 12 && hour <= 18) timeFactor = 1.3; // Active

        return Math.min(8, Math.round(baseScore * timeFactor * 10) / 10);
    },

    // Final Observation Score (0-100, Higher is Better)
    calculateObservationScore: (params) => {
        const WEIGHTS = {
            seeing: 0.25,
            transparency: 0.15,
            cloud: 0.20,
            wind: 0.10,
            jetstream: 0.20,
            convection: 0.10
        };

        const weightedSum =
            params.seeing * WEIGHTS.seeing +
            params.transparency * WEIGHTS.transparency +
            params.cloud * WEIGHTS.cloud +
            params.wind * WEIGHTS.wind +
            params.jetstream * WEIGHTS.jetstream +
            params.convection * WEIGHTS.convection;

        // Inverse calculation: 8 (Worst) -> 0, 0 (Best) -> 100
        const finalScore = 100 - ((weightedSum / 8.0) * 100);
        const roundedScore = Math.round(finalScore * 10) / 10;

        return {
            score: roundedScore,
            grade: WeatherService.getGrade(roundedScore),
            recommendation: WeatherService.getRecommendation(roundedScore)
        };
    },

    getGrade: (score) => {
        if (score >= 85) return 'S';
        if (score >= 70) return 'A';
        if (score >= 55) return 'B';
        if (score >= 40) return 'C';
        return 'D';
    },

    getRecommendation: (score) => {
        if (score >= 85) return 'Excellent conditions! Great for all targets.';
        if (score >= 70) return 'Very good conditions. Suitable for most observations.';
        if (score >= 55) return 'Average conditions. Good for bright targets.';
        if (score >= 40) return 'Poor conditions. Limited to casual observation.';
        return 'Unsuitable for observation.';
    },

    // Cloud Normalization: 0-100% -> 0-8 scale
    normalizeCloud: (percent) => {
        if (typeof percent !== 'number') return null;
        return Math.round((percent * 8) / 100);
    },

    // Helper: Find closest OpenMeteo index for a given Date
    findOpenMeteoIndex: (omData, targetDate) => {
        if (!omData || !omData.hourly || !omData.hourly.time) return -1;
        const targetTime = targetDate.getTime();
        let minDiff = Infinity;
        let index = -1;

        for (let i = 0; i < omData.hourly.time.length; i++) {
            const t = new Date(omData.hourly.time[i]).getTime();
            const diff = Math.abs(t - targetTime);
            if (diff < minDiff) {
                minDiff = diff;
                index = i;
            } else if (diff > minDiff) break;
        }
        return index;
    },

    // Helper: Find closest Met.no data for a given Date
    findMetNoData: (metData, targetDate) => {
        if (!metData || !metData.properties || !metData.properties.timeseries) return null;
        const targetTime = targetDate.getTime();
        let closest = null;
        let minDiff = Infinity;

        for (const item of metData.properties.timeseries) {
            const t = new Date(item.time).getTime();
            const diff = Math.abs(t - targetTime);
            if (diff < minDiff) {
                minDiff = diff;
                closest = item.data.instant.details;
            }
        }
        return closest;
    },

    getAggregatedForecast: async (lat, lon) => {
        const [timerData, omData, metData] = await Promise.all([
            ProviderService.fetch7Timer(lat, lon),
            ProviderService.fetchOpenMeteo(lat, lon),
            ProviderService.fetchMetNo(lat, lon)
        ]);

        if (!timerData || !timerData.dataseries) {
            throw new Error('Primary data source (7Timer) failed');
        }

        const now = new Date();

        const aggregated = timerData.dataseries.map(item => {
            const timepoint = item.timepoint;
            const targetDate = new Date(now.getTime() + timepoint * 60 * 60 * 1000);
            const hour = targetDate.getHours();

            const temps = [];
            const humidities = [];
            const clouds = []; // normalized 0-8
            const winds = []; // m/s
            const jetStreams = []; // m/s (250hPa)
            const capes = []; // J/kg

            // --- 1. 7Timer Data ---
            if (item.temp2m != null) temps.push(item.temp2m);
            if (item.rh2m != null && item.rh2m > 0) humidities.push(item.rh2m); // Assuming %
            // 7Timer Cloud: 1-9. Convert to 0-8. (val-1)
            // If val is 1 (clear), score 0. If val 9 (overcast), score 8.
            if (item.cloudcover != null) match = clouds.push(Math.max(0, item.cloudcover - 1));

            // --- 2. Open-Meteo Data ---
            const omIdx = WeatherService.findOpenMeteoIndex(omData, targetDate);
            if (omIdx !== -1) {
                const h = omData.hourly;
                if (h.temperature_2m[omIdx] != null) temps.push(h.temperature_2m[omIdx]);
                if (h.relative_humidity_2m[omIdx] != null) humidities.push(h.relative_humidity_2m[omIdx]);
                if (h.cloud_cover[omIdx] != null) clouds.push(WeatherService.normalizeCloud(h.cloud_cover[omIdx]));
                if (h.wind_speed_10m[omIdx] != null) winds.push(h.wind_speed_10m[omIdx] / 3.6); // km/h -> m/s

                // New Metrics
                if (h.wind_speed_250hPa && h.wind_speed_250hPa[omIdx] != null) {
                    jetStreams.push(h.wind_speed_250hPa[omIdx] / 3.6); // km/h -> m/s
                }
                if (h.cape && h.cape[omIdx] != null) {
                    capes.push(h.cape[omIdx]);
                }
            }

            // --- 3. Met.no Data ---
            const met = WeatherService.findMetNoData(metData, targetDate);
            if (met) {
                if (met.air_temperature != null) temps.push(met.air_temperature);
                if (met.relative_humidity != null) humidities.push(met.relative_humidity);
                if (met.cloud_area_fraction != null) clouds.push(WeatherService.normalizeCloud(met.cloud_area_fraction));
                if (met.wind_speed != null) winds.push(met.wind_speed);
            }

            // --- Averages ---
            const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

            const finalTemp = avg(temps);
            const finalHum = avg(humidities);
            const finalCloudScore = avg(clouds) ?? 0;
            const finalWind = avg(winds) ?? 0;
            const finalJetStream = avg(jetStreams);
            const finalCape = avg(capes);

            // --- Scoring Preparation ---
            // Seeing: 7Timer 1(Good)-5(Bad)? -> Map to 0-8
            // Map 1->0, 2->2, 3->4, 4->6, 5->8
            let rawSeeing = item.seeing || 5;
            const seeingScore = (rawSeeing - 1) * 2;

            // Transparency: 7Timer 1(Good)-8(Bad)? -> Map to 0-8 (Assuming 1-based, extract 1?)
            // If 7Timer transparency is 1-8, we can map 1->0 ... 8->7. Or just use raw-1.
            // Let's assume raw-1 for now to likely hit 0-7 range.
            let rawTransparency = item.transparency || 8;
            const transparencyScore = Math.max(0, rawTransparency - 1);

            // Wind Score (0-8)
            // <5 m/s = 0, >10 m/s = 8? 
            // Simple Linear map: 0m/s -> 0, 10m/s -> 8?
            // Let's say: <2: 0, <5: 2, <8: 4, <12: 6, >12: 8
            let windScore = 0;
            if (finalWind < 2) windScore = 0;
            else if (finalWind < 5) windScore = 2;
            else if (finalWind < 8) windScore = 4;
            else if (finalWind < 12) windScore = 6;
            else windScore = 8;

            // Jet Stream Score
            const jetStepScore = WeatherService.calculateJetStreamScore(finalJetStream);

            // Convection Score
            const convectionScore = WeatherService.calculateConvectionScore(finalCape, hour);

            // Final Calculation
            const calculation = WeatherService.calculateObservationScore({
                seeing: seeingScore,
                transparency: transparencyScore,
                cloud: finalCloudScore,
                wind: windScore,
                jetstream: jetStepScore,
                convection: convectionScore
            });

            return {
                timepoint: item.timepoint,
                // Display Values
                temp2m: finalTemp !== null ? Math.round(finalTemp) : 0,
                rh2m: finalHum !== null ? Math.round(finalHum) : 0,
                wind10m: {
                    direction: item.wind10m && item.wind10m.direction ? item.wind10m.direction : 'N/A',
                    speed: parseFloat(finalWind.toFixed(1))
                },

                // Scoring Components (0-8 scale)
                scores: {
                    seeing: parseFloat(seeingScore.toFixed(1)),
                    transparency: parseFloat(transparencyScore.toFixed(1)),
                    cloudCover: parseFloat(finalCloudScore.toFixed(1)),
                    wind: parseFloat(windScore.toFixed(1)),
                    jetStream: parseFloat(jetStepScore.toFixed(1)),
                    convection: parseFloat(convectionScore.toFixed(1))
                },

                // Data for Debug/UI
                raw: {
                    jetStreamSpeed: finalJetStream ? Math.round(finalJetStream * 1.94384) : 0, // knots
                    cape: finalCape ? Math.round(finalCape) : 0
                },

                // Final Result
                score: calculation.score,
                grade: calculation.grade,
                recommendation: calculation.recommendation
            };
        });

        return aggregated;
    }
};

module.exports = WeatherService;
