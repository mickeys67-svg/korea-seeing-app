const ProviderService = require('./providerService');
const ScoringService = require('./scoringService');
const USPModel = require('./USPModel');
const AnalysisService = require('./analysisService');
const KmaService = require('./kmaService');
const EnsembleService = require('./ensembleService');
// Firestore reference — set by server.js via setDb() to avoid duplicate connections
let _firestoreDb = null;
function _getDb() { return _firestoreDb; }
function _setDb(db) { _firestoreDb = db; }

// ═══ Last-Known-Good Cache — serves stale data when all APIs fail ═══
// In-memory, resets on container restart (which is fine — natural cleanup)
const _cache = new Map();
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours
const CACHE_MAX = 50;                  // max entries (~2.5MB)

function _cacheKey(lat, lon, lang) {
    return `${lat.toFixed(1)},${lon.toFixed(1)},${lang}`;
}
function _cacheGet(lat, lon, lang) {
    const entry = _cache.get(_cacheKey(lat, lon, lang));
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(_cacheKey(lat, lon, lang)); return null; }
    return entry.data;
}
function _cacheSet(lat, lon, lang, data) {
    const key = _cacheKey(lat, lon, lang);
    if (_cache.size >= CACHE_MAX && !_cache.has(key)) {
        // Evict oldest entry
        const oldest = _cache.keys().next().value;
        _cache.delete(oldest);
    }
    _cache.set(key, { data, ts: Date.now() });
}

// Simple timezone lookup from coordinates (covers major observatory regions)
function getTimezoneFromCoords(lat, lon) {
    // Korea (33-39N, 124-131E) — lon ≤131 avoids Tsushima/Fukuoka overlap with Japan
    if (lat >= 33 && lat <= 39 && lon >= 124 && lon <= 131) return { tz: 'Asia/Seoul', offset: 32400 };
    // Japan (24-46N, 127-146E)
    if (lat >= 24 && lat <= 46 && lon >= 127 && lon <= 146) return { tz: 'Asia/Tokyo', offset: 32400 };
    // Eastern China (18-54N, 73-135E)
    if (lat >= 18 && lat <= 54 && lon >= 73 && lon <= 135) return { tz: 'Asia/Shanghai', offset: 28800 };
    // US Eastern (-5)
    if (lat >= 24 && lat <= 50 && lon >= -85 && lon <= -65) return { tz: 'America/New_York', offset: -18000 };
    // US Central (-6)
    if (lat >= 24 && lat <= 50 && lon >= -105 && lon <= -85) return { tz: 'America/Chicago', offset: -21600 };
    // US Mountain (-7)
    if (lat >= 24 && lat <= 50 && lon >= -115 && lon <= -105) return { tz: 'America/Denver', offset: -25200 };
    // US Pacific (-8)
    if (lat >= 24 && lat <= 50 && lon >= -130 && lon <= -115) return { tz: 'America/Los_Angeles', offset: -28800 };
    // Western Europe (0)
    if (lat >= 36 && lat <= 60 && lon >= -10 && lon <= 2) return { tz: 'Europe/London', offset: 0 };
    // Central Europe (+1)
    if (lat >= 36 && lat <= 60 && lon >= 2 && lon <= 20) return { tz: 'Europe/Berlin', offset: 3600 };
    // Eastern Europe (+2)
    if (lat >= 36 && lat <= 60 && lon >= 20 && lon <= 40) return { tz: 'Europe/Helsinki', offset: 7200 };
    // Australia Eastern (+10)
    if (lat >= -45 && lat <= -10 && lon >= 140 && lon <= 155) return { tz: 'Australia/Sydney', offset: 36000 };
    return null;
}

// ═══ Quality Scoring Helper Functions (v2.0 — Global Standard Calibrated) ═══

// 7Timer seeing index (1-8) → arcseconds conversion
// 7Timer bins: 1=<0.5" 2=0.5-0.75" 3=0.75-1" 4=1-1.25" 5=1.25-1.5" 6=1.5-2" 7=2-2.5" 8=>2.5"
function _7timerToArcsec(code) {
    const map = [0, 0.4, 0.6, 0.9, 1.1, 1.4, 1.75, 2.25, 3.0];
    if (code < 1 || code > 8) return null;
    return map[code] || null;
}

// Non-linear seeing → score (0-8, 0=best)
// More granular in the 0.5-2.5" range where observation quality changes most
// Anchors: 0.5"→0, 0.8"→1, 1.2"→2.5, 1.8"→4, 2.5"→5.5, 3.5"→7, 5.0"→8
function _seeingToScore(seeing) {
    if (seeing <= 0.5) return 0;
    if (seeing <= 0.8) return (seeing - 0.5) / 0.3 * 1.0;           // 0→1
    if (seeing <= 1.2) return 1.0 + (seeing - 0.8) / 0.4 * 1.5;    // 1→2.5
    if (seeing <= 1.8) return 2.5 + (seeing - 1.2) / 0.6 * 1.5;    // 2.5→4
    if (seeing <= 2.5) return 4.0 + (seeing - 1.8) / 0.7 * 1.5;    // 4→5.5
    if (seeing <= 3.5) return 5.5 + (seeing - 2.5) / 1.0 * 1.5;    // 5.5→7
    if (seeing <= 5.0) return 7.0 + (seeing - 3.5) / 1.5 * 1.0;    // 7→8
    return 8;
}

// Continuous wind → score (0-8, 0=best)
// Replaces 4-level discrete mapping: provides smooth gradation across full range
function _windToScore(wind) {
    if (wind == null) return 3; // neutral — no data
    if (wind <= 2) return 0;
    if (wind <= 5) return (wind - 2) / 3 * 2;           // 0→2
    if (wind <= 8) return 2 + (wind - 5) / 3 * 2;       // 2→4
    if (wind <= 12) return 4 + (wind - 8) / 4 * 2;      // 4→6
    if (wind <= 20) return 6 + (wind - 12) / 8 * 2;     // 6→8
    return 8;
}

// Derive transparency from physical proxies when 7Timer is unavailable
// Humidity → water vapor scattering, AOD → aerosol extinction, PM2.5 → particle scatter
function _deriveTransparency(humidity, aod, pm25, elevation) {
    let score = 2.0; // base: decent transparency
    // Humidity: water vapor absorbs and scatters light
    if (humidity != null) {
        if (humidity > 85) score += 2.5;
        else if (humidity > 70) score += 1.5;
        else if (humidity > 55) score += 0.5;
        else if (humidity < 30) score -= 0.5; // very dry = excellent
    }
    // AOD: direct atmospheric transparency measure (lower = cleaner)
    if (aod != null) {
        if (aod > 0.4) score += 2.0;       // heavy aerosol
        else if (aod > 0.25) score += 1.0;  // moderate
        else if (aod > 0.1) score += 0.5;   // light
        else score -= 0.3;                    // very clean air
    }
    // PM2.5: particulate scatter (ug/m3)
    if (pm25 != null) {
        if (pm25 > 75) score += 2.0;     // unhealthy air
        else if (pm25 > 35) score += 1.0; // moderate pollution
        else if (pm25 > 15) score += 0.5; // light haze
    }
    // Elevation: higher = less atmosphere to look through
    if (elevation != null && elevation > 1000) score -= 0.5;
    if (elevation != null && elevation > 2000) score -= 0.5; // additional bonus
    return Math.min(8, Math.max(0, score));
}

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

    mapSourceData: (targetDate, item, omData, metData, aqData, kmaData, ensembleData, metarData) => {
        // clouds: non-OM sources only (7Timer, Met.no) to avoid double-counting with 3-layer blend
        // omCloud: OM total cloud separately (used as fallback when layers unavailable)
        // kmaCloudScore: KMA 초단기예보 SKY 기반 (한국 좌표, 최우선 적용)
        // ensembleMaxCloud: Ensemble 다중모델 비관적 구름 (0-8 스케일)
        // metarOktas: METAR 실측 구름 (0-8 oktas)
        const values = { temps: [], humidities: [], clouds: [], omCloud: null, winds: [], jetStreams: [], capes: [], kmaCloudScore: null, ensembleMaxCloud: null, metarOktas: null };
        const isValid = (val) => val != null && val > -9000;
        if (isValid(item.temp2m)) values.temps.push(item.temp2m);
        if (isValid(item.rh2m)) values.humidities.push(item.rh2m);
        if (isValid(item.cloudcover)) values.clouds.push(Math.max(0, item.cloudcover - 1));
        if (omData && omData.hourly && omData.hourly.time) {
            const omIdx = WeatherService.findClosestItem(omData.hourly.time, targetDate);
            if (omIdx !== null) {
                const h = omData.hourly;
                if (h.temperature_2m && h.temperature_2m[omIdx] != null) values.temps.push(h.temperature_2m[omIdx]);
                if (h.relative_humidity_2m && h.relative_humidity_2m[omIdx] != null) values.humidities.push(h.relative_humidity_2m[omIdx]);
                // OM total cloud kept separate to avoid double-counting with 3-layer blend
                if (h.cloud_cover && h.cloud_cover[omIdx] != null) values.omCloud = ScoringService.normalizeCloud(h.cloud_cover[omIdx]);
                if (h.cloud_cover_low && h.cloud_cover_low[omIdx] != null) values.cloudLow = h.cloud_cover_low[omIdx];
                if (h.cloud_cover_mid && h.cloud_cover_mid[omIdx] != null) values.cloudMid = h.cloud_cover_mid[omIdx];
                if (h.cloud_cover_high && h.cloud_cover_high[omIdx] != null) values.cloudHigh = h.cloud_cover_high[omIdx];
                if (h.wind_speed_10m && h.wind_speed_10m[omIdx] != null) values.winds.push(h.wind_speed_10m[omIdx] / 3.6);
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
                if (diff < minDiff) { minDiff = diff; closestMet = mItem.data?.instant?.details; }
            }
            if (closestMet) {
                if (closestMet.air_temperature != null) values.temps.push(closestMet.air_temperature);
                if (closestMet.relative_humidity != null) values.humidities.push(closestMet.relative_humidity);
                if (closestMet.cloud_area_fraction != null) values.clouds.push(ScoringService.normalizeCloud(closestMet.cloud_area_fraction));
                if (closestMet.wind_speed != null) values.winds.push(closestMet.wind_speed);
            }
        }

        // Air Quality data integration (PM2.5 + AOD for USP model)
        let pm25 = null;
        let aod = null;
        if (aqData && aqData.hourly && aqData.hourly.time) {
            const aqIdx = WeatherService.findClosestItem(aqData.hourly.time, targetDate);
            if (aqIdx !== null) {
                if (aqData.hourly.pm2_5 && aqData.hourly.pm2_5[aqIdx] != null) pm25 = aqData.hourly.pm2_5[aqIdx];
                // AOD: accept whichever key the API returned (current or legacy)
                const aodArr = aqData.hourly.aerosol_optical_depth || aqData.hourly.aerosol_optical_depth_550nm;
                if (aodArr && aodArr[aqIdx] != null) aod = aodArr[aqIdx];
            }
        }

        // ═══ KMA 기상청 초단기예보 (Korea only) ═══
        if (kmaData) {
            const kmaSlot = KmaService.findClosestSlot(kmaData, targetDate);
            if (kmaSlot) {
                if (kmaSlot.t1h != null && !isNaN(kmaSlot.t1h)) values.temps.push(kmaSlot.t1h);
                if (kmaSlot.reh != null && !isNaN(kmaSlot.reh)) values.humidities.push(kmaSlot.reh);
                if (kmaSlot.wsd != null && !isNaN(kmaSlot.wsd)) values.winds.push(kmaSlot.wsd);
                if (kmaSlot.sky != null) {
                    values.kmaCloudScore = KmaService.skyToCloudScore(kmaSlot.sky, kmaSlot.pty || 0);
                }
            }
        }

        // ═══ Ensemble 다중모델 구름 (전세계) ═══
        if (ensembleData) {
            const ensSlot = EnsembleService.findClosestSlot(ensembleData, targetDate);
            if (ensSlot && ensSlot.maxCloud != null) {
                // 0-100% → 0-8 스케일 (scoringService와 동일)
                values.ensembleMaxCloud = ScoringService.normalizeCloud(ensSlot.maxCloud);
            }
        }

        // ═══ METAR 실측 구름 (전세계 공항) ═══
        // METAR는 현재 시점 관측값이므로 첫 3시간만 적용 (이후는 예측 데이터 사용)
        if (metarData && metarData.oktas != null && metarData.obsTime) {
            const obsDate = new Date(metarData.obsTime);
            if (!isNaN(obsDate.getTime())) {
                const hoursSinceObs = (targetDate.getTime() - obsDate.getTime()) / (3600 * 1000);
                // 관측 후 3시간 이내 예보 슬롯에만 적용
                if (hoursSinceObs >= -1 && hoursSinceObs <= 3) {
                    values.metarOktas = metarData.oktas;
                }
            }
        }

        const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

        // ═══ 3-Layer Cloud Scoring ═══
        // When layer data is available, use weighted sum instead of total cloud.
        // Astronomical impact: low clouds are opaque, high cirrus is semi-transparent.
        //   Low  (0-2km):  weight 1.0 — fully blocks starlight
        //   Mid  (2-6km):  weight 0.8 — mostly blocks
        //   High (6km+):   weight 0.3 — thin cirrus, moon/bright stars visible through
        // ── Compute base cloud score from Open-Meteo / 7Timer / Met.no ──
        // null = "데이터 없음" (거짓 맑음 방지), 실제 맑음은 항상 숫자 0
        let baseCloudScore = null;
        if (values.cloudLow != null && values.cloudMid != null && values.cloudHigh != null) {
            const layerCloud = (
                values.cloudLow * 1.0 +
                values.cloudMid * 0.8 +
                values.cloudHigh * 0.3
            ) / (1.0 + 0.8 + 0.3);  // max = 100 when all layers 100%
            const layerNorm = ScoringService.normalizeCloud(Math.min(100, layerCloud));
            // Blend with non-OM sources (7Timer, Met.no) — no double-counting
            if (values.clouds.length > 0) {
                const otherAvg = avg(values.clouds);
                baseCloudScore = layerNorm * 0.6 + otherAvg * 0.4;
            } else {
                baseCloudScore = layerNorm;
            }
        } else {
            // No layer data — fall back to all available sources including OM total
            const allClouds = [...values.clouds];
            if (values.omCloud != null) allClouds.push(values.omCloud);
            baseCloudScore = allClouds.length > 0 ? avg(allClouds) : null; // null = 데이터 없음 (NOT 0)
        }
        const hasBase = baseCloudScore != null;

        // ═══ Smart Cloud Blending (4-Layer Fallback) ═══
        // 우선순위: 실측(KMA/METAR) > Ensemble(다중모델) > base(기존 NWP)
        // 천문관측용 비관적 접근: 구름이 있는데 "맑음"이 최악 → 항상 보수적
        // ★ base=null일 때: enhanced 소스가 100% 가중치 (0으로 희석하지 않음)
        let cloudScore;
        const hasKma = values.kmaCloudScore != null;
        const hasMetar = values.metarOktas != null;
        const hasEnsemble = values.ensembleMaxCloud != null;
        const safeBase = baseCloudScore ?? 0; // 가중합 계산용 (null-safe)

        if (hasKma) {
            // ★ 한국: KMA 실측 최우선
            if (hasEnsemble && hasBase) {
                cloudScore = values.kmaCloudScore * 0.5 + values.ensembleMaxCloud * 0.3 + safeBase * 0.2;
            } else if (hasEnsemble) {
                // base 없음 → KMA+Ensemble만으로 100%
                cloudScore = values.kmaCloudScore * 0.6 + values.ensembleMaxCloud * 0.4;
            } else if (hasBase) {
                cloudScore = values.kmaCloudScore * 0.7 + safeBase * 0.3;
            } else {
                // KMA만 있음 → 100%
                cloudScore = values.kmaCloudScore;
            }
        } else if (hasMetar && hasEnsemble) {
            if (hasBase) {
                cloudScore = values.metarOktas * 0.4 + values.ensembleMaxCloud * 0.35 + safeBase * 0.25;
            } else {
                // base 없음 → METAR+Ensemble만으로 100%
                cloudScore = values.metarOktas * 0.55 + values.ensembleMaxCloud * 0.45;
            }
        } else if (hasMetar) {
            if (hasBase) {
                cloudScore = values.metarOktas * 0.6 + safeBase * 0.4;
            } else {
                cloudScore = values.metarOktas; // METAR 100%
            }
        } else if (hasEnsemble) {
            if (hasBase) {
                cloudScore = values.ensembleMaxCloud * 0.6 + safeBase * 0.4;
            } else {
                cloudScore = values.ensembleMaxCloud; // Ensemble 100%
            }
        } else if (hasBase) {
            // enhanced 없음, base만 있음
            cloudScore = safeBase;
        } else {
            // ★ 모든 구름 데이터 없음 → 중립값 4 (거짓 맑음 방지)
            // 0=맑음은 거짓, 8=흐림은 거짓 → 4=불확실(중립) 가장 안전
            cloudScore = 4;
        }

        return {
            temp: avg(values.temps), humidity: avg(values.humidities), cloudScore: parseFloat(Math.min(8, Math.max(0, isNaN(cloudScore) ? 4 : cloudScore)).toFixed(1)),
            wind: avg(values.winds), jetStream: avg(values.jetStreams), cape: avg(values.capes),
            tempMin: values.temps.length ? Math.min(...values.temps) : 0, tempMax: values.temps.length ? Math.max(...values.temps) : 0,
            pm25: pm25, aod: aod,
            cloudLow: values.cloudLow ?? null, cloudMid: values.cloudMid ?? null, cloudHigh: values.cloudHigh ?? null
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
            // TKE estimation from wind shear + Richardson number (replaces hardcoded 0.5)
            const shearTKE = Math.pow(Math.abs(windShear) * dz, 2) * 0.1;
            let stabilityFactor;
            if (ri > 0.25) stabilityFactor = 0.3;       // stable → suppressed
            else if (ri > 0) stabilityFactor = 0.7;      // neutral
            else stabilityFactor = 1.5;                   // unstable → enhanced
            const tke = Math.max(0.05, Math.min(3.0, shearTKE * stabilityFactor));
            layers.push({ tke, windShear, ri, dz });
        }
        return layers;
    },

    getAggregatedForecast: async (lat, lon, targetLang = 'en') => {
        // Fetch all data sources in parallel (7 API calls)
        // Ensemble + METAR 추가 — 실패해도 null 반환으로 안전
        let [timerData, omData, metData, aqData, kmaData, ensembleData, metarData] = await Promise.all([
            ProviderService.fetch7Timer(lat, lon),
            ProviderService.fetchOpenMeteo(lat, lon, ['best_match', 'gfs_seamless', 'ecmwf_ifs']),
            ProviderService.fetchMetNo(lat, lon),
            ProviderService.fetchAirQuality(lat, lon),
            ProviderService.fetchKMA(lat, lon),
            ProviderService.fetchEnsembleCloud(lat, lon),
            ProviderService.fetchMetar(lat, lon)
        ]);

        // API Health Tracking — raw success/failure before fallback logic
        const isKR = KmaService.isKorea(lat, lon);
        const apiHealth = {
            timer: !!(timerData && timerData.dataseries && timerData.dataseries.length > 0),
            openmeteo: !!omData,
            metno: !!metData,
            airquality: !!aqData,
            kma: isKR ? !!kmaData : null,  // null = not applicable (non-Korea)
            ensemble: !!ensembleData,
            metar: !!metarData,
        };

        // ═══ 3-Tier Timeline Fallback ═══
        // Tier 1: 7Timer (primary) → Tier 2: Open-Meteo → Tier 3: Met.no → Cache → Error
        let useTimer = apiHealth.timer;
        if (!useTimer && !omData && !metData) {
            // All 3 global sources failed — try serving cached data
            const cached = _cacheGet(lat, lon, targetLang);
            if (cached) {
                console.warn('[Cache] Serving last-known-good data — all 3 global APIs failed');
                return { ...cached, meta: { ...cached.meta, apiHealth } };
            }
            throw new Error('All global data sources (7Timer + Open-Meteo + Met.no) failed');
        }
        if (!useTimer) {
            // Generate synthetic 3-hour timepoints (OM/Met.no data will override in mapSourceData)
            console.warn('[Weather] 7Timer failed — generating synthetic timeline' + (!omData ? ' (Met.no tertiary mode)' : ''));
            const syntheticData = [];
            for (let tp = 3; tp <= 72; tp += 3) {
                syntheticData.push({
                    timepoint: tp,
                    cloudcover: null, // null = no data, NOT 0 (clear) — forces fallback to other sources
                    seeing: 5,
                    transparency: null,
                    temp2m: null,
                    rh2m: null,
                    wind10m: { direction: 'N/A', speed: 3 }
                });
            }
            timerData = { dataseries: syntheticData, _synthetic: true };
        }

        // Helper to extract model-specific data from consolidated Open-Meteo response
        const getModelData = (om, suffix) => {
            if (!om || !om.hourly) return null;
            const res = { hourly: { time: om.hourly.time }, timezone: om.timezone, utc_offset_seconds: om.utc_offset_seconds };
            Object.keys(om.hourly).forEach(key => {
                if (suffix === 'best_match') {
                    if (!key.includes('_gfs') && !key.includes('_ecmwf')) {
                        // Strip _best_match suffix if present (OM adds it for multi-model requests)
                        const baseKey = key.endsWith('_best_match') ? key.replace('_best_match', '') : key;
                        res.hourly[baseKey] = om.hourly[key];
                    }
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
        const siteElevation = omBest?.elevation ?? omGfs?.elevation ?? 50;
        // Urban estimation: high altitude or low BLH → non-urban (no external API needed)
        const blh = omBest?.hourly?.boundary_layer_height?.[0] ?? null;
        const isUrban = siteElevation < 500 && (blh != null ? blh > 1500 : false);
        const now = new Date();
        const ensembleModels = [omBest, omGfs, omEcmwf].filter(m => m !== null);
        const mappedForecast = timerData.dataseries.map(item => {
            const targetDate = new Date(now.getTime() + item.timepoint * 60 * 60 * 1000);
            const hour = targetDate.getHours();

            // 1. Data Blending (Baseline from 7Timer + Best Match + Met.no + AQ + KMA + Ensemble + METAR)
            const mapped = WeatherService.mapSourceData(targetDate, item, omBest, metData, aqData, kmaData, ensembleData, metarData);

            // 2. Ensemble USP Model Processing
            let uspResults = ensembleModels.map(m => {
                const layers = WeatherService.prepareUSPData(targetDate, m);
                return USPModel.calculate({
                    layers,
                    surfaceWind: mapped.wind ?? 0,
                    jetStreamSpeed: mapped.jetStream != null ? mapped.jetStream * 1.94384 : null,
                    targetAltitude: 90, urban: isUrban, elevation: siteElevation,
                    aod: mapped.aod, pm25: mapped.pm25,
                    variance: mapped.tempMax - mapped.tempMin,
                    humidity: mapped.humidity
                });
            });

            // Fallback if ensemble failed
            if (uspResults.length === 0) {
                uspResults = [USPModel.calculate({
                    layers: [],
                    surfaceWind: mapped.wind ?? 0,
                    jetStreamSpeed: mapped.jetStream != null ? mapped.jetStream * 1.94384 : null,
                    targetAltitude: 90, urban: isUrban, elevation: siteElevation,
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

            // 4. Scoring & Observation Detail — compute once, reuse everywhere
            // Multi-model seeing blend: USP (physics) + 7Timer (CMC model) for diversity
            const timerSeeingArcsec = (!timerData._synthetic && item.seeing != null) ? _7timerToArcsec(item.seeing) : null;
            const blendedSeeing = timerSeeingArcsec != null
                ? finalUsp.seeing * 0.6 + timerSeeingArcsec * 0.4
                : finalUsp.seeing;
            const seeingScore = parseFloat(Math.min(8, Math.max(0, _seeingToScore(blendedSeeing))).toFixed(1));
            // Transparency: 7Timer when available, physics-derived fallback otherwise
            const transparencyScore = item.transparency != null
                ? parseFloat(Math.max(0, item.transparency - 1).toFixed(1))
                : parseFloat(_deriveTransparency(mapped.humidity, mapped.aod, mapped.pm25, siteElevation).toFixed(1));
            const windScore = parseFloat(_windToScore(mapped.wind).toFixed(1));
            const jetStreamScore = parseFloat(ScoringService.calculateJetStreamScore(mapped.jetStream).toFixed(1));
            const convectionScore = parseFloat(ScoringService.calculateConvectionScore(mapped.cape, hour).toFixed(1));

            const observationDetail = ScoringService.calculateObservationScore({
                seeing: seeingScore,
                transparency: transparencyScore,
                cloud: mapped.cloudScore,
                wind: windScore,
                jetstream: jetStreamScore,
                convection: convectionScore
            }, targetLang);

            return {
                time: targetDate.toISOString(),
                timepoint: item.timepoint,
                temp2m: Math.round(mapped.temp ?? 0),
                rh2m: Math.round(mapped.humidity ?? 0),
                wind10m: {
                    direction: item.wind10m?.direction || 'N/A',
                    speed: parseFloat((mapped.wind ?? 0).toFixed(1))
                },
                usp: finalUsp,
                scores: {
                    seeing: seeingScore,
                    transparency: transparencyScore,
                    cloudCover: parseFloat(mapped.cloudScore.toFixed(1)),
                    wind: windScore,
                    jetStream: jetStreamScore,
                    convection: convectionScore
                },
                raw: {
                    jetStreamSpeed: mapped.jetStream != null ? Math.round(mapped.jetStream * 1.94384) : null,
                    cape: Math.round(mapped.cape || 0),
                    confidence: finalUsp.confidence
                },
                cloudLayers: {
                    low: mapped.cloudLow != null ? Math.round(mapped.cloudLow) : null,
                    mid: mapped.cloudMid != null ? Math.round(mapped.cloudMid) : null,
                    high: mapped.cloudHigh != null ? Math.round(mapped.cloudHigh) : null,
                },
                score: observationDetail.score,
                grade: observationDetail.grade,
                recommendation: observationDetail.recommendation,
                // Internal: air quality for training data (not sent to frontend)
                _pm25: mapped.pm25,
                _aod: mapped.aod
            };
        });

        // ═══ Training Data Collection (fire-and-forget, no await) ═══
        const db = _getDb();
        if (db && mappedForecast.length > 0) {
            try {
                const col = db.collection('trainingData');
                const batch = db.batch();
                mappedForecast.forEach(f => {
                    batch.set(col.doc(), {
                        timestamp: new Date(f.time),
                        lat, lon, elevation: siteElevation, isUrban,
                        inputs: {
                            seeing: f.usp?.seeing ?? null, transparency: f.scores?.transparency ?? null,
                            cloudScore: f.scores?.cloudCover ?? null, wind: f.wind10m?.speed ?? null,
                            jetStream: f.raw?.jetStreamSpeed ?? null, cape: f.raw?.cape ?? null,
                            humidity: f.rh2m ?? null, temp: f.temp2m ?? null,
                            pm25: f._pm25 ?? null, aod: f._aod ?? null,
                            moonPhase: 0, moonFraction: 0,
                        },
                        layers: f.cloudLayers || {},
                        predicted: {
                            score: f.score ?? null, grade: f.grade ?? null,
                            uspSeeing: f.usp?.seeing ?? null, uspConfidence: f.usp?.confidence ?? null,
                            r0: f.usp?.details?.r0 ?? null,
                        },
                        apiSources: apiHealth,
                        actual: null,
                        createdAt: new Date(),
                    });
                });
                batch.commit().catch(err => console.warn('[Training] Firestore batch fail:', err.message));
            } catch { /* silent — training data is optional */ }
        }

        // Timezone resolution: Open-Meteo > coordinate lookup > UTC
        let resolvedTz = omBest?.timezone || null;
        let resolvedOffset = omBest?.utc_offset_seconds || 0;
        if (!resolvedTz || resolvedTz === 'UTC' || resolvedTz === 'GMT') {
            const coordTz = getTimezoneFromCoords(lat, lon);
            if (coordTz) {
                resolvedTz = coordTz.tz;
                resolvedOffset = coordTz.offset;
            } else {
                resolvedTz = resolvedTz || 'UTC';
            }
        }

        // 5. Active Insight (rule-based) — timezone resolved, pass offset for correct local time display
        let aiInsight = null;
        const currentBlock = mappedForecast[0];
        if (currentBlock) {
            aiInsight = AnalysisService.getActiveInsight(currentBlock, mappedForecast, targetLang, resolvedOffset);
        }

        const result = {
            forecast: mappedForecast,
            aiSummary: aiInsight,
            meta: {
                timezone: resolvedTz,
                timezoneOffset: resolvedOffset,
                ensemble: ensembleModels.length,
                sources: ['7Timer', 'Open-Meteo (Ensemble)', 'Met.no', 'Cloud-Ensemble', 'METAR'],
                apiHealth
            }
        };

        // Update cache on successful result
        _cacheSet(lat, lon, targetLang, result);

        return result;
    }
};

WeatherService.setDb = _setDb;
module.exports = WeatherService;
