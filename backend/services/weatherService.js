const ProviderService = require('./providerService');
const ScoringService = require('./scoringService');

const WeatherService = {
    // Helper: Generic closest index/item finder
    findClosestItem: (times, targetDate) => {
        if (!times || times.length === 0) return null;

        const targetTime = targetDate.getTime();
        let minDiff = Infinity;
        let closestIndex = -1;

        for (let i = 0; i < times.length; i++) {
            const t = new Date(times[i]).getTime();
            const diff = Math.abs(t - targetTime);
            if (diff > minDiff) break;
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }
        return closestIndex !== -1 ? closestIndex : null;
    },

    getAggregatedForecast: async (lat, lon) => {
        // 1. Fetch Data in Parallel
        const [timerData, omData, metData] = await Promise.all([
            ProviderService.fetch7Timer(lat, lon),
            ProviderService.fetchOpenMeteo(lat, lon),
            ProviderService.fetchMetNo(lat, lon)
        ]);

        if (!timerData || !timerData.dataseries) {
            throw new Error('Primary data source (7Timer) failed');
        }

        const now = new Date();

        return timerData.dataseries.map(item => {
            const timepoint = item.timepoint;
            const targetDate = new Date(now.getTime() + timepoint * 60 * 60 * 1000);
            const hour = targetDate.getHours();

            const values = {
                temps: [],
                humidities: [],
                clouds: [],
                winds: [],
                jetStreams: [],
                capes: []
            };

            // --- 1. 7Timer Data ---
            if (item.temp2m != null) values.temps.push(item.temp2m);
            if (item.rh2m != null) values.humidities.push(item.rh2m);
            // 7Timer Cloud: 1-9 -> 0-8
            if (item.cloudcover != null) values.clouds.push(Math.max(0, item.cloudcover - 1));

            // --- 2. Open-Meteo Data ---
            if (omData && omData.hourly && omData.hourly.time) {
                const omIdx = WeatherService.findClosestItem(omData.hourly.time, targetDate);
                if (omIdx !== null) {
                    const h = omData.hourly;
                    if (h.temperature_2m[omIdx] != null) values.temps.push(h.temperature_2m[omIdx]);
                    if (h.relative_humidity_2m[omIdx] != null) values.humidities.push(h.relative_humidity_2m[omIdx]);
                    if (h.cloud_cover[omIdx] != null) values.clouds.push(ScoringService.normalizeCloud(h.cloud_cover[omIdx]));
                    if (h.wind_speed_10m[omIdx] != null) values.winds.push(h.wind_speed_10m[omIdx] / 3.6); // km/h -> m/s
                    if (h.wind_speed_250hPa && h.wind_speed_250hPa[omIdx] != null) values.jetStreams.push(h.wind_speed_250hPa[omIdx] / 3.6);
                    if (h.cape && h.cape[omIdx] != null) values.capes.push(h.cape[omIdx]);
                }
            }

            // --- 3. Met.no Data ---
            if (metData && metData.properties && metData.properties.timeseries) {
                let closestMet = null;
                let minDiff = Infinity;
                const targetTime = targetDate.getTime();

                for (const mItem of metData.properties.timeseries) {
                    const t = new Date(mItem.time).getTime();
                    const diff = Math.abs(t - targetTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestMet = mItem.data.instant.details;
                    }
                }

                if (closestMet) {
                    if (closestMet.air_temperature != null) values.temps.push(closestMet.air_temperature);
                    if (closestMet.relative_humidity != null) values.humidities.push(closestMet.relative_humidity);
                    if (closestMet.cloud_area_fraction != null) values.clouds.push(ScoringService.normalizeCloud(closestMet.cloud_area_fraction));
                    if (closestMet.wind_speed != null) values.winds.push(closestMet.wind_speed);
                }
            }

            // --- Averages ---
            const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

            const finalTemp = avg(values.temps);
            const finalHum = avg(values.humidities);
            const finalCloudScore = avg(values.clouds) ?? 0;
            const finalWind = avg(values.winds) ?? 0;
            const finalJetStream = avg(values.jetStreams);
            const finalCape = avg(values.capes);

            // --- Scoring ---
            const rawSeeing = item.seeing || 5;
            const seeingScore = (rawSeeing - 1) * 2;

            const rawTransparency = item.transparency || 8;
            const transparencyScore = Math.max(0, rawTransparency - 1);

            let windScore = 0;
            if (finalWind < 2) windScore = 0;
            else if (finalWind < 5) windScore = 2;
            else if (finalWind < 8) windScore = 4;
            else if (finalWind < 12) windScore = 6;
            else windScore = 8;

            const jetStepScore = ScoringService.calculateJetStreamScore(finalJetStream);
            const convectionScore = ScoringService.calculateConvectionScore(finalCape, hour);

            const calculation = ScoringService.calculateObservationScore({
                seeing: seeingScore,
                transparency: transparencyScore,
                cloud: finalCloudScore,
                wind: windScore,
                jetstream: jetStepScore,
                convection: convectionScore
            });

            return {
                time: targetDate.toISOString(),
                timepoint: item.timepoint,
                temp2m: finalTemp !== null ? Math.round(finalTemp) : 0,
                rh2m: finalHum !== null ? Math.round(finalHum) : 0,
                wind10m: {
                    direction: (item.wind10m && item.wind10m.direction) ? item.wind10m.direction : 'N/A',
                    speed: typeof finalWind === 'number' ? parseFloat(finalWind.toFixed(1)) : 0
                },
                scores: {
                    seeing: parseFloat(seeingScore.toFixed(1)),
                    transparency: parseFloat(transparencyScore.toFixed(1)),
                    cloudCover: parseFloat(finalCloudScore.toFixed(1)),
                    wind: parseFloat(windScore.toFixed(1)),
                    jetStream: parseFloat(jetStepScore.toFixed(1)),
                    convection: parseFloat(convectionScore.toFixed(1))
                },
                raw: {
                    jetStreamSpeed: finalJetStream ? Math.round(finalJetStream * 1.94384) : 0,
                    cape: finalCape ? Math.round(finalCape) : 0
                },
                score: calculation.score,
                grade: calculation.grade,
                recommendation: calculation.recommendation
            };
        });
    }
};

module.exports = WeatherService;
