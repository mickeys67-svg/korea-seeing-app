/**
 * v5.0 Photo Guide — Orchestrator Service
 *
 * /api/photo-forecast 의 핵심 오케스트레이터.
 *
 * 아키텍처 원칙:
 *   1. 기존 WeatherService.getAggregatedForecast() — **READ-ONLY 호출**
 *      · 기존 캐시 경유로 비용 0 추가 (같은 요청 시 동일 스냅샷 재사용)
 *   2. fetchOpenMeteoForPhoto() — photo 전용 신규 7개 변수 별도 fetch
 *   3. twilightService / phenomenaService — astronomy-engine 로컬 계산
 *   4. categories/*.js — 장르별 스코어러 (순수함수)
 *   5. 자체 LRU 캐시 (prefix: "photo:") — 기존 캐시와 완전 분리
 *
 * 장애 격리:
 *   · WeatherService 장애 → 제한 모드 (photo 변수만으로 계산 시도)
 *   · fetchOpenMeteoForPhoto 장애 → photo-ext 변수 null로 계산
 *   · 어느 경우에도 /api/weather 응답 0% 변화
 */
const WeatherService = require('../weatherService');
const { fetchOpenMeteoForPhoto, buildPhotoIndex } = require('./fetchOpenMeteoForPhoto');
const twilightService = require('./twilightService');
const phenomenaService = require('./phenomenaService');
const Astronomy = require('astronomy-engine');

const skyColor    = require('./categories/skyColor');
const general     = require('./categories/general');
const longExposure = require('./categories/longExposure');
const fogSubject  = require('./categories/fogSubject');
const mudflat     = require('./categories/mudflat');
const phenomena   = require('./categories/phenomena');
const suggestions = require('./categories/suggestions');

const { isCoastalKorea, isKoreaRegion } = require('./categories/_shared');

// ─── 독립 LRU 캐시 ────────────────────────────────────────────
const _cache = new Map();
const _CACHE_MAX = 120;
const _CACHE_TTL = 3 * 60 * 1000;  // 3분
const _pending = new Map();

function _cacheKey(lat, lon, lang) {
    const gLat = (Math.round(lat * 20) / 20).toFixed(2);
    const gLon = (Math.round(lon * 20) / 20).toFixed(2);
    return `photo:${gLat},${gLon},${lang}`;
}

function _cacheGet(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > _CACHE_TTL) {
        _cache.delete(key);
        return null;
    }
    return entry.data;
}

function _cacheSet(key, data) {
    if (_cache.size >= _CACHE_MAX && !_cache.has(key)) {
        const oldest = _cache.keys().next().value;
        _cache.delete(oldest);
    }
    _cache.set(key, { data, ts: Date.now() });
}

// ─── 천체 정보 (moon fraction 등) ─────────────────────────────
function getMoonContext(date) {
    try {
        const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
        return {
            moonFraction: illum.phase_fraction,
            moonMagnitude: illum.mag,
        };
    } catch (e) {
        return { moonFraction: null, moonMagnitude: null };
    }
}

// ─── 슬롯 데이터 빌더 ─────────────────────────────────────────
/**
 * WeatherService의 forecast slot + photo-only OM 변수 → 정규화된 photo slot
 *
 * @param {object} weatherSlot - WeatherService 슬롯 {time, temp2m, rh2m, wind10m, cloudLayers, scores, dewPointSpread, ...}
 * @param {object|null} photoVars - { visibility, precipitation, precipProb, windGusts10m, uvIndex, surfacePressure, isDay }
 */
function buildPhotoSlot(weatherSlot, photoVars) {
    const cloudLow  = weatherSlot.cloudLayers?.low  ?? null;
    const cloudMid  = weatherSlot.cloudLayers?.mid  ?? null;
    const cloudHigh = weatherSlot.cloudLayers?.high ?? null;
    const cloudTotal =
        cloudLow != null || cloudMid != null || cloudHigh != null
            ? Math.min(100, (cloudLow || 0) + (cloudMid || 0) + (cloudHigh || 0))
            : null;

    return {
        time: weatherSlot.time,
        weather: {
            // base
            temp2m: weatherSlot.temp2m ?? null,
            relativeHumidity: weatherSlot.rh2m ?? null,
            windSpeed: weatherSlot.wind10m?.speed ?? null,
            windDirection: weatherSlot.wind10m?.direction ?? null,
            cloudCoverLow:   cloudLow,
            cloudCoverMid:   cloudMid,
            cloudCoverHigh:  cloudHigh,
            cloudCoverTotal: cloudTotal,
            dewPointSpread: weatherSlot.dewPointSpread ?? null,
            jetStreamSpeed: weatherSlot.raw?.jetStreamSpeed ?? null,
            cape: weatherSlot.raw?.cape ?? null,
            // photo-ext (may be null if fetch failed)
            visibility:      photoVars?.visibility ?? null,
            precipitation:   photoVars?.precipitation ?? null,
            precipProb:      photoVars?.precipProb ?? null,
            windGusts:       photoVars?.windGusts10m ?? null,
            uvIndex:         photoVars?.uvIndex ?? null,
            surfacePressure: photoVars?.surfacePressure ?? null,
            isDay:           photoVars?.isDay ?? null,
        },
    };
}

// ─── 메인 엔트리 ──────────────────────────────────────────────
/**
 * /api/photo-forecast 의 서비스 레이어.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {string} lang - en/ko/ja/zh
 * @returns {Promise<object>}
 */
async function getPhotoForecast(lat, lon, lang = 'en') {
    const key = _cacheKey(lat, lon, lang);

    // 1. 캐시 히트
    const cached = _cacheGet(key);
    if (cached) return cached;

    // 2. 펜딩 dedup
    if (_pending.has(key)) return _pending.get(key);

    const promise = (async () => {
        // 3. 병렬: WeatherService (기존) + photo-only Open-Meteo
        const [weatherResult, photoOmRaw] = await Promise.all([
            WeatherService.getAggregatedForecast(lat, lon, lang).catch(e => {
                console.warn('[photoService] WeatherService failed:', e.message);
                return null;
            }),
            fetchOpenMeteoForPhoto(lat, lon).catch(e => {
                console.warn('[photoService] fetchOpenMeteoForPhoto failed:', e.message);
                return null;
            }),
        ]);

        const weatherSlots = weatherResult?.forecast || [];
        const utcOffsetSeconds = weatherResult?.meta?.timezoneOffset ?? 0;
        const photoIndex = buildPhotoIndex(photoOmRaw);
        const elevation = photoOmRaw?.elevation ?? 0;

        if (weatherSlots.length === 0) {
            return {
                location: { lat, lon, elevation, timezoneOffset: utcOffsetSeconds },
                forecast: [],
                twilight: [],
                phenomena: [],
                topSuggestionsNow: [],
                meta: {
                    version: '5.0.0',
                    mode: 'error',
                    reason: 'no-weather-data',
                    generatedAt: new Date().toISOString(),
                },
            };
        }

        // 4. Twilight — 4일치 (일반적으로 weatherSlots 범위 커버)
        const startDate = new Date(weatherSlots[0].time);
        const twilightDays = twilightService.getTwilightForecast(
            startDate, 4, lat, lon, utcOffsetSeconds
        );
        const twilightByDate = new Map();
        for (const td of twilightDays) twilightByDate.set(td.date, td);

        // 5. Phenomena — 30일 이내 lunar/solar eclipse, supermoon, meteor shower
        const phenomenaCalendar = phenomenaService.getPhenomenaForecast(startDate, lat, lon, 30);

        // 6. 지리 플래그
        const isCoastal = isCoastalKorea(lat, lon);
        const isUrban = false; // TODO: 도시 판정 개선
        const siteElevation = elevation;

        // 7. 각 슬롯 처리
        let prevSlot = null;
        const photoSlots = weatherSlots.map(ws => {
            const photoVars = photoIndex.get(ws.time) || null;
            const slot = buildPhotoSlot(ws, photoVars);

            // 해당 슬롯의 twilight day
            const localDate = new Date(
                new Date(slot.time).getTime() + utcOffsetSeconds * 1000
            ).toISOString().slice(0, 10);
            const twilightDay = twilightByDate.get(localDate) || null;

            // 태양 context
            const solar = twilightDay
                ? twilightService.getSolarContext(slot.time, twilightDay, lat, lon)
                : null;

            // 천체 (달)
            const moon = getMoonContext(new Date(slot.time));

            // 카테고리 계산 컨텍스트
            const context = {
                solar,
                twilightDay,
                astro: moon,
                elevation: siteElevation,
                isCoastal,
                isUrban,
                lat,
                lon,
                utcOffsetSeconds,
                prevSlot,
                phenomenaCalendar,
            };

            // 카테고리별 점수 계산 (각각 독립, 실패 격리)
            const catSafe = (fn, name) => {
                try { return fn(slot, context); }
                catch (e) {
                    console.warn(`[photoService] category ${name} failed:`, e.message);
                    return { score: 0, grade: 'D', raw: 0, error: true };
                }
            };

            const categories = {
                general:      catSafe(general.calculate,      'general'),
                longExposure: catSafe(longExposure.calculate, 'longExposure'),
                fogSubject:   catSafe(fogSubject.calculate,   'fogSubject'),
                skyColor:     catSafe(skyColor.calculate,     'skyColor'),
                mudflat:      catSafe(mudflat.calculate,      'mudflat'),
                phenomena:    catSafe(phenomena.calculate,    'phenomena'),
            };

            // Suggestions — 30개 규칙
            const slotSuggestions = suggestions.generateSuggestions(slot, context, categories, 5);

            const out = {
                time: slot.time,
                weather: slot.weather,
                solar: solar ? {
                    phase: solar.phase,
                    sunAltitude: solar.sunAltitude,
                    sunAzimuth: solar.sunAzimuth,
                    isGoldenHour: solar.isGoldenHour,
                    isBlueHour: solar.isBlueHour,
                    isBeltOfVenus: solar.isBeltOfVenus,
                    isDay: solar.isDay,
                    isNight: solar.isNight,
                } : null,
                moon: moon,
                categories,
                suggestions: slotSuggestions,
            };

            prevSlot = slot;
            return out;
        });

        // 8. Top Suggestions Now — 현재 시각 가장 가까운 슬롯에서 상위 3개 인사이트
        const topSuggestionsNow = buildTopSuggestionsNow(photoSlots, phenomenaCalendar);

        const result = {
            location: {
                lat,
                lon,
                elevation: siteElevation,
                isCoastal,
                timezone: weatherResult?.meta?.timezone || 'UTC',
                timezoneOffset: utcOffsetSeconds,
            },
            forecast: photoSlots,
            twilight: twilightDays,
            phenomena: phenomenaCalendar,
            topSuggestionsNow,
            meta: {
                version: '5.0.0',
                mode: photoOmRaw ? 'full' : 'limited',
                hasPhotoVars: !!photoOmRaw,
                hasWeatherData: true,
                generatedAt: new Date().toISOString(),
                ruleCount: suggestions.rules.length,
            },
        };

        _cacheSet(key, result);
        return result;
    })();

    _pending.set(key, promise);
    promise.finally(() => _pending.delete(key));
    return promise;
}

// ─── Top Suggestions Now 빌더 ─────────────────────────────────
/**
 * 프론트 1층 카드 — "지금 당장 뭐 찍을까" 핵심 인사이트 3개
 *  · 다음 Burning/Vivid Sky (24h 이내)
 *  · 다음 Fog 기회 (48h 이내)
 *  · 가장 가까운 자연현상 (30일 이내)
 */
function buildTopSuggestionsNow(photoSlots, phenomenaCalendar) {
    const now = Date.now();
    const out = [];

    // 1. Next Burning/Vivid Sky (24h 이내)
    const skyCandidate = photoSlots.find(s => {
        const t = new Date(s.time).getTime();
        if (t < now) return false;
        if (t > now + 24 * 3600 * 1000) return false;
        const sc = s.categories?.skyColor;
        return sc && (sc.palette === 'burning' || sc.palette === 'vivid') && sc.isActiveTime;
    });
    if (skyCandidate) {
        out.push({
            id: 'next-sky-color',
            type: 'sky-color',
            time: skyCandidate.time,
            score: skyCandidate.categories.skyColor.score,
            palette: skyCandidate.categories.skyColor.palette,
            paletteIcon: skyCandidate.categories.skyColor.paletteIcon,
            direction: skyCandidate.categories.skyColor.colorDirection,
            textKey: `top-sky-${skyCandidate.categories.skyColor.palette}`,
        });
    }

    // 2. Next Fog opportunity (48h 이내)
    const fogCandidate = photoSlots.find(s => {
        const t = new Date(s.time).getTime();
        if (t < now) return false;
        if (t > now + 48 * 3600 * 1000) return false;
        const f = s.categories?.fogSubject;
        return f && f.raw > 0.55;
    });
    if (fogCandidate) {
        out.push({
            id: 'next-fog-opportunity',
            type: 'fog',
            time: fogCandidate.time,
            score: fogCandidate.categories.fogSubject.score,
            fogType: fogCandidate.categories.fogSubject.fogType,
            textKey: 'top-fog-opportunity',
        });
    }

    // 3. Nearest phenomenon (visible)
    const nearestPhenom = phenomenaCalendar.find(p =>
        (p.visible ?? true) && typeof p.dDay === 'number' && p.dDay >= 0
    );
    if (nearestPhenom) {
        out.push({
            id: 'nearest-phenomenon',
            type: 'phenomenon',
            subtype: nearestPhenom.type,
            date: nearestPhenom.date,
            peakTime: nearestPhenom.peakTime,
            dDay: nearestPhenom.dDay,
            direction: nearestPhenom.direction || null,
            textKey: `top-phenom-${nearestPhenom.type}`,
        });
    }

    return out;
}

module.exports = {
    getPhotoForecast,
    buildPhotoSlot,      // 테스트용 export
    buildTopSuggestionsNow,
};
