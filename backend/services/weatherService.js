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
        const [timerData, omData, metData, aqData] = await Promise.all([
            ProviderService.fetch7Timer(lat, lon),
            ProviderService.fetchOpenMeteo(lat, lon),
            ProviderService.fetchMetNo(lat, lon),
            ProviderService.fetchAirQuality(lat, lon)
        ]);

        if (!timerData || !timerData.dataseries) {
            throw new Error('Primary data source (7Timer) failed');
        }

        const now = new Date();

        const mappedForecast = timerData.dataseries.map(item => {
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

            // --- 1. 7Timer Data (Defensive Checks) ---
            const isValid = (val) => val != null && val > -9000; // Filter sentinels like -9999 or -20000

            if (isValid(item.temp2m)) values.temps.push(item.temp2m);
            if (isValid(item.rh2m)) values.humidities.push(item.rh2m);
            // 7Timer Cloud: 1-9 -> 0-8
            if (isValid(item.cloudcover)) values.clouds.push(Math.max(0, item.cloudcover - 1));

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

            // --- USP Model Data Preparation ---
            const layers = [];
            if (omData && omData.hourly) {
                const omIdx = WeatherService.findClosestItem(omData.hourly.time, targetDate);
                if (omIdx !== null) {
                    const h = omData.hourly;
                    const pressureLevels = ['1000hPa', '925hPa', '850hPa', '700hPa', '500hPa', '300hPa', '250hPa', '200hPa'];

                    for (let i = 0; i < pressureLevels.length - 1; i++) {
                        const level1 = pressureLevels[i];
                        const level2 = pressureLevels[i + 1];

                        const t1 = h[`temperature_${level1}`][omIdx];
                        const t2 = h[`temperature_${level2}`][omIdx];
                        const v1 = h[`wind_speed_${level1}`][omIdx] / 3.6; // km/h to m/s
                        const v2 = h[`wind_speed_${level2}`][omIdx] / 3.6;

                        const z1 = WeatherService.PRESSURE_LEVEL_HEIGHTS[level1];
                        const z2 = WeatherService.PRESSURE_LEVEL_HEIGHTS[level2];
                        const dz = z2 - z1;

                        const windShear = (v2 - v1) / dz;
                        const dT = t2 - t1;

                        // Richardson Number estimate: Ri = (g/T) * (dT/dz) / (dV/dz)^2
                        // g = 9.8, T in Kelvin
                        const avgT = (t1 + t2) / 2 + 273.15;
                        const ri = (9.8 / avgT) * (dT / dz) / Math.pow(windShear || 0.001, 2);

                        layers.push({
                            tke: 0.5, // Proxy value if not available
                            windShear: windShear,
                            ri: ri,
                            dz: dz
                        });
                    }
                }
            }

            // Get Air Quality data for the current hour
            let currentAod = 0.1;
            let currentPm25 = 10;
            if (aqData && aqData.hourly) {
                const aqIdx = WeatherService.findClosestItem(aqData.hourly.time, targetDate);
                if (aqIdx !== null) {
                    currentAod = aqData.hourly.aerosol_optical_depth_550nm[aqIdx] || 0.1;
                    currentPm25 = aqData.hourly.pm2_5[aqIdx] || 10;
                }
            }

            const uspResult = USPModel.calculate({
                layers: layers,
                surfaceWind: finalWind,
                jetStreamSpeed: finalJetStream ? finalJetStream * 1.94384 : 40,
                targetAltitude: 90, // Zenith by default
                urban: true, // assume urban for now or fetch from location
                elevation: 50, // default
                aod: currentAod,
                pm25: currentPm25
            });

            // --- Scoring ---
            // Fix: Clamp raw values to ensure scores stay in bounds (0-8)
            let rawSeeing = item.seeing || 5;
            if (rawSeeing > 5) rawSeeing = 5;
            if (rawSeeing < 1) rawSeeing = 1;

            const seeingScore = (rawSeeing - 1) * 2; // Result: 0, 2, 4, 6, 8

            // 7Timer Transparency is 1 (Best) to 8 (Worst)
            let rawTransparency = item.transparency || 8;
            if (rawTransparency > 8) rawTransparency = 8;
            if (rawTransparency < 1) rawTransparency = 1;

            const transparencyScore = Math.max(0, rawTransparency - 1); // Result: 0-7

            let windScore = 0;
            if (finalWind < 2) windScore = 0;
            else if (finalWind < 5) windScore = 2;
            else if (finalWind < 8) windScore = 4;
            else if (finalWind < 12) windScore = 6;
            else windScore = 8;

            const jetStepScore = ScoringService.calculateJetStreamScore(finalJetStream);
            const convectionScore = ScoringService.calculateConvectionScore(finalCape, hour);

            const observationDetail = ScoringService.calculateObservationScore({
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
                usp: uspResult, // New USP Model Results
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
                score: observationDetail.score,
                grade: observationDetail.grade,
                recommendation: observationDetail.recommendation
            };
        });

        // Return both forecast and metadata
        return {
            forecast: mappedForecast,
            meta: {
                timezone: (omData && omData.timezone) ? omData.timezone : 'UTC',
                timezoneOffset: (omData && omData.utc_offset_seconds) ? omData.utc_offset_seconds : 0
            }
        };
    }
};

module.exports = WeatherService;
