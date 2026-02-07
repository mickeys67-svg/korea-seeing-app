const ProviderService = require('./providerService');
const ScoringService = require('./scoringService');
const USPModel = require('./USPModel');
const AnalysisService = require('./analysisService');

const WeatherService = {
    // ... [Rest of the constants and helpers remain unchanged] ...
    PRESSURE_LEVEL_HEIGHTS: {
        '1000hPa': 110,
        '925hPa': 760,
        '850hPa': 1450,
        '700hPa': 3010,
        '500hPa': 5570,
        '300hPa': 9160,
        '250hPa': 10360,
        '200hPa': 11780
    },

    findClosestItem: (times, targetDate) => {
        if (!times || times.length === 0) return null;
        const targetTime = targetDate.getTime();
        let minDiff = Infinity;
        let closestIndex = -1;
        for (let i = 0; i < times.length; i++) {
            const t = new Date(times[i]).getTime();
            const diff = Math.abs(t - targetTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }
        return closestIndex !== -1 ? closestIndex : null;
    },

    mapSourceData: (targetDate, item, omData, metData, aqData) => {
        const values = { temps: [], humidities: [], clouds: [], winds: [], jetStreams: [], capes: [] };
        const isValid = (val) => val != null && val > -9000;
        if (isValid(item.temp2m)) values.temps.push(item.temp2m);
        if (isValid(item.rh2m)) values.humidities.push(item.rh2m);
        if (isValid(item.cloudcover)) values.clouds.push(Math.max(0, item.cloudcover - 1));
        if (omData && omData.hourly && omData.hourly.time) {
            const omIdx = WeatherService.findClosestItem(omData.hourly.time, targetDate);
            if (omIdx !== null) {
                const h = omData.hourly;
                if (h.temperature_2m[omIdx] != null) values.temps.push(h.temperature_2m[omIdx]);
                if (h.relative_humidity_2m[omIdx] != null) values.humidities.push(h.relative_humidity_2m[omIdx]);
                if (h.cloud_cover[omIdx] != null) values.clouds.push(ScoringService.normalizeCloud(h.cloud_cover[omIdx]));
                if (h.wind_speed_10m[omIdx] != null) values.winds.push(h.wind_speed_10m[omIdx] / 3.6);
                if (h.wind_speed_250hPa && h.wind_speed_250hPa[omIdx] != null) values.jetStreams.push(h.wind_speed_250hPa[omIdx] / 3.6);
                if (h.cape && h.cape[omIdx] != null) values.capes.push(h.cape[omIdx]);
            }
        }
        if (metData && metData.properties && metData.properties.timeseries) {
            let closestMet = null;
            let minDiff = Infinity;
            const targetTime = targetDate.getTime();
            for (const mItem of metData.properties.timeseries) {
                const t = new Date(mItem.time).getTime();
                const diff = Math.abs(t - targetTime);
                if (diff < minDiff) { minDiff = diff; closestMet = mItem.data.instant.details; }
            }
            if (closestMet) {
                if (closestMet.air_temperature != null) values.temps.push(closestMet.air_temperature);
                if (closestMet.relative_humidity != null) values.humidities.push(closestMet.relative_humidity);
                if (closestMet.cloud_area_fraction != null) values.clouds.push(ScoringService.normalizeCloud(closestMet.cloud_area_fraction));
                if (closestMet.wind_speed != null) values.winds.push(closestMet.wind_speed);
            }
        }
        const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        return {
            temp: avg(values.temps), humidity: avg(values.humidities), cloudScore: avg(values.clouds) ?? 0,
            wind: avg(values.winds) ?? 0, jetStream: avg(values.jetStreams), cape: avg(values.capes),
            tempMin: values.temps.length ? Math.min(...values.temps) : 0, tempMax: values.temps.length ? Math.max(...values.temps) : 0
        };
    },

    prepareUSPData: (targetDate, omData) => {
        const layers = [];
        if (!omData || !omData.hourly) return layers;
        const omIdx = WeatherService.findClosestItem(omData.hourly.time, targetDate);
        if (omIdx === null) return layers;
        const h = omData.hourly;
        const pressureLevels = ['1000hPa', '925hPa', '850hPa', '700hPa', '500hPa', '300hPa', '250hPa', '200hPa'];
        for (let i = 0; i < pressureLevels.length - 1; i++) {
            const level1 = pressureLevels[i]; const level2 = pressureLevels[i + 1];
            const t1 = h[`temperature_${level1}`] ? h[`temperature_${level1}`][omIdx] : null;
            const t2 = h[`temperature_${level2}`] ? h[`temperature_${level2}`][omIdx] : null;
            const v1 = h[`wind_speed_${level1}`] ? h[`wind_speed_${level1}`][omIdx] / 3.6 : null;
            const v2 = h[`wind_speed_${level2}`] ? h[`wind_speed_${level2}`][omIdx] / 3.6 : null;
            if (t1 === null || t2 === null || v1 === null || v2 === null) continue;
            const z1 = WeatherService.PRESSURE_LEVEL_HEIGHTS[level1];
            const z2 = WeatherService.PRESSURE_LEVEL_HEIGHTS[level2];
            const dz = z2 - z1;
            const windShear = (v2 - v1) / dz;
            const dT = t2 - t1;
            const avgT = (t1 + t2) / 2 + 273.15;
            const ri = (9.8 / avgT) * (dT / dz) / Math.pow(windShear || 0.001, 2);
            layers.push({ tke: 0.5, windShear, ri, dz });
        }
        return layers;
    },

    getAggregatedForecast: async (lat, lon) => {
        // Fetch Ensemble Data for full 7 days
        const [timerData, omData, metData, aqData] = await Promise.all([
            ProviderService.fetch7Timer(lat, lon),
            ProviderService.fetchOpenMeteo(lat, lon, ['best_match', 'gfs_seamless', 'ecmwf_ifs']),
            ProviderService.fetchMetNo(lat, lon),
            ProviderService.fetchAirQuality(lat, lon)
        ]);

        if (!timerData || !timerData.dataseries) {
            throw new Error('Primary data source (7Timer) failed');
        }

        // Helper to extract model-specific data from consolidated Open-Meteo response
        const getModelData = (om, suffix) => {
            if (!om || !om.hourly) return null;
            const res = { hourly: { time: om.hourly.time }, timezone: om.timezone, utc_offset_seconds: om.utc_offset_seconds };
            Object.keys(om.hourly).forEach(key => {
                if (suffix === 'best_match' && !key.includes('_gfs') && !key.includes('_ecmwf')) {
                    res.hourly[key] = om.hourly[key];
                } else if (key.endsWith(`_${suffix}`)) {
                    const baseKey = key.replace(`_${suffix}`, '');
                    res.hourly[baseKey] = om.hourly[key];
                }
            });
            return res;
        };

        const omBest = getModelData(omData, 'best_match');
        const omGfs = getModelData(omData, 'gfs_seamless');
        const omEcmwf = getModelData(omData, 'ecmwf_ifs');
        const now = new Date();
        const ensembleModels = [omBest, omGfs, omEcmwf].filter(m => m !== null);
        const mappedForecast = timerData.dataseries.map(item => {
            const targetDate = new Date(now.getTime() + item.timepoint * 60 * 60 * 1000);
            const hour = targetDate.getHours();

            // 1. Data Blending (Baseline from 7Timer + Best Match + Met.no + AQ)
            const mapped = WeatherService.mapSourceData(targetDate, item, omBest, metData, aqData);

            // 2. Ensemble USP Model Processing
            let uspResults = ensembleModels.map(m => {
                const layers = WeatherService.prepareUSPData(targetDate, m);
                return USPModel.calculate({
                    layers,
                    surfaceWind: mapped.wind,
                    jetStreamSpeed: mapped.jetStream ? mapped.jetStream * 1.94384 : 40,
                    targetAltitude: 90, urban: true, elevation: 50,
                    aod: mapped.aod || 0.15, pm25: mapped.pm25 || 12,
                    variance: mapped.tempMax - mapped.tempMin,
                    humidity: mapped.humidity
                });
            });

            // Fallback if ensemble failed
            if (uspResults.length === 0) {
                uspResults = [USPModel.calculate({
                    layers: [],
                    surfaceWind: mapped.wind,
                    jetStreamSpeed: mapped.jetStream ? mapped.jetStream * 1.94384 : 40,
                    targetAltitude: 90, urban: true, elevation: 50,
                    humidity: mapped.humidity
                })];
            }

            // 3. Weighted Average calculation
            const avgSeeing = uspResults.reduce((sum, r) => sum + r.seeing, 0) / uspResults.length;
            const avgScore = uspResults.reduce((sum, r) => sum + r.score, 0) / uspResults.length;
            const combinedConfidence = uspResults.reduce((sum, r) => sum + r.confidence, 0) / uspResults.length;

            const finalUsp = {
                ...uspResults[0], // Details from primary model
                seeing: parseFloat(avgSeeing.toFixed(2)),
                score: parseFloat(avgScore.toFixed(1)),
                confidence: Math.round(combinedConfidence)
            };

            // 4. Scoring & Observation Detail
            const observationDetail = ScoringService.calculateObservationScore({
                seeing: (finalUsp.seeing - 0.4) * 2,
                transparency: Math.max(0, (item.transparency || 8) - 1),
                cloud: mapped.cloudScore,
                wind: mapped.wind < 2 ? 0 : (mapped.wind < 5 ? 2 : (mapped.wind < 8 ? 4 : 8)),
                jetstream: ScoringService.calculateJetStreamScore(mapped.jetStream),
                convection: ScoringService.calculateConvectionScore(mapped.cape, hour)
            });

            return {
                time: targetDate.toISOString(),
                timepoint: item.timepoint,
                temp2m: Math.round(mapped.temp || 0),
                rh2m: Math.round(mapped.humidity || 0),
                wind10m: {
                    direction: item.wind10m?.direction || 'N/A',
                    speed: parseFloat(mapped.wind.toFixed(1))
                },
                usp: finalUsp,
                scores: {
                    seeing: parseFloat(((finalUsp.seeing - 0.4) * 2).toFixed(1)),
                    transparency: parseFloat(Math.max(0, (item.transparency || 8) - 1).toFixed(1)),
                    cloudCover: parseFloat(mapped.cloudScore.toFixed(1)),
                    wind: parseFloat((mapped.wind < 2 ? 0 : (mapped.wind < 5 ? 2 : (mapped.wind < 8 ? 4 : 8))).toFixed(1)),
                    jetStream: parseFloat(ScoringService.calculateJetStreamScore(mapped.jetStream).toFixed(1)),
                    convection: parseFloat(ScoringService.calculateConvectionScore(mapped.cape, hour).toFixed(1))
                },
                raw: {
                    jetStreamSpeed: Math.round(mapped.jetStream * 1.94384 || 0),
                    cape: Math.round(mapped.cape || 0),
                    confidence: finalUsp.confidence
                },
                score: observationDetail.score,
                grade: observationDetail.grade,
                recommendation: observationDetail.recommendation
            };
        });

        // 5. Active AI Insight
        let aiInsight = null;
        const bestBlock = [...mappedForecast].sort((a, b) => b.score - a.score)[0];
        if (bestBlock) {
            aiInsight = await AnalysisService.getActiveInsight(bestBlock);
        }

        return {
            forecast: mappedForecast,
            aiSummary: aiInsight,
            meta: {
                timezone: omBest?.timezone || 'UTC',
                timezoneOffset: omBest?.utc_offset_seconds || 0,
                ensemble: ensembleModels.length,
                sources: ['7Timer', 'Open-Meteo (Ensemble)', 'Met.no']
            }
        };
    }
};

module.exports = WeatherService;
