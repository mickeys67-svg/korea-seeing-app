const axios = require('axios');

// ═══ API별 그리드 캐시 — 데이터 해상도에 맞춘 좌표 라운딩 ═══
// 각 API의 실제 공간 해상도에 맞게 좌표를 라운딩하여 캐시
// → 인접 좌표 요청이 같은 캐시 히트 → 외부 API 호출 절감
const _GRID = {
    '7timer':     { step: 0.5, ttl: 30 * 60 * 1000 },  // ~55km, 30분 (데이터 3시간 단위)
    'openmeteo':  { step: 0.1, ttl:  5 * 60 * 1000 },  // ~11km, 5분  (hourly 예보)
    'metno':      { step: 0.1, ttl:  5 * 60 * 1000 },  // ~11km, 5분
    'airquality': { step: 0.2, ttl: 10 * 60 * 1000 },  // ~22km, 10분 (공기질 느리게 변화)
    'ensemble':   { step: 0.2, ttl: 10 * 60 * 1000 },  // ~22km, 10분 (ECMWF 0.25°)
    'kma':        { step: 0.05, ttl: 3 * 60 * 1000 },  // ~5km,  3분  (5km LCC 격자)
    'metar':      { step: 0.2, ttl:  5 * 60 * 1000 },  // ~22km, 5분  (공항 기준)
    // GK2A, Radiosonde: 자체 캐시 보유 — 여기서 중복 캐시 불필요
};
const _apiCache = new Map();   // key: `${apiName}_${gridLat}_${gridLon}` → { data, ts }
const _API_CACHE_MAX = 200;

function _gridKey(apiName, lat, lon) {
    const g = _GRID[apiName];
    if (!g) return null;
    const gLat = (Math.round(lat / g.step) * g.step).toFixed(3);
    const gLon = (Math.round(lon / g.step) * g.step).toFixed(3);
    return `${apiName}_${gLat}_${gLon}`;
}

function _gridGet(apiName, lat, lon) {
    const key = _gridKey(apiName, lat, lon);
    if (!key) return undefined;
    const entry = _apiCache.get(key);
    if (!entry) return undefined;
    const ttl = _GRID[apiName]?.ttl || 5 * 60 * 1000;
    if (Date.now() - entry.ts > ttl) { _apiCache.delete(key); return undefined; }
    return entry.data;
}

function _gridSet(apiName, lat, lon, data) {
    const key = _gridKey(apiName, lat, lon);
    if (!key) return;
    if (_apiCache.size >= _API_CACHE_MAX && !_apiCache.has(key)) {
        const oldest = _apiCache.keys().next().value;
        _apiCache.delete(oldest);
    }
    _apiCache.set(key, { data, ts: Date.now() });
}

// Request-level dedup: 같은 그리드 셀에 대한 동시 요청은 Promise 공유
const _pendingApiCalls = new Map();

function _gridFetch(apiName, lat, lon, fetchFn) {
    // 1. 캐시 확인
    const cached = _gridGet(apiName, lat, lon);
    if (cached !== undefined) return Promise.resolve(cached);

    // 2. 진행 중인 요청 합치기
    const key = _gridKey(apiName, lat, lon);
    if (key) {
        const pending = _pendingApiCalls.get(key);
        if (pending) return pending;
    }

    // 3. 새 요청 시작
    const promise = fetchFn().then(result => {
        _gridSet(apiName, lat, lon, result);
        return result;
    });
    if (key) {
        _pendingApiCalls.set(key, promise);
        promise.catch(() => {}).finally(() => _pendingApiCalls.delete(key));
    }
    return promise;
}

// ═══ Circuit Breaker — per-API failure tracking (in-memory) ═══
// Prevents repeatedly calling a dead API (saves timeout wait time)
// CLOSED → normal calls. OPEN → skip for cooldown period. HALF-OPEN → try one call.
const _circuits = {
    '7timer':     { failures: 0, openUntil: 0 },
    'openmeteo':  { failures: 0, openUntil: 0 },
    'metno':      { failures: 0, openUntil: 0 },
    'airquality': { failures: 0, openUntil: 0 },
    'kma':        { failures: 0, openUntil: 0 },
    'ensemble':   { failures: 0, openUntil: 0 },
    'metar':      { failures: 0, openUntil: 0 },
    'gk2a':       { failures: 0, openUntil: 0 },
    'radiosonde': { failures: 0, openUntil: 0 },
};
const CIRCUIT_THRESHOLD = 3;            // consecutive failures to open
const CIRCUIT_COOLDOWN = 5 * 60 * 1000; // 5 min before half-open retry

// Normalize log names to circuit keys: "7Timer" → "7timer", "Open-Meteo" → "openmeteo"
function _toKey(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ProviderService = {
    // ── Circuit Breaker helpers ──
    _isCircuitOpen(name) {
        const c = _circuits[_toKey(name)];
        if (!c || c.failures < CIRCUIT_THRESHOLD) return false;
        if (Date.now() < c.openUntil) return true; // still cooling down
        return false; // cooldown expired → half-open, allow one attempt
    },
    _recordSuccess(name) {
        const c = _circuits[_toKey(name)];
        if (c) { c.failures = 0; c.openUntil = 0; }
    },
    _recordFailure(name) {
        const c = _circuits[_toKey(name)];
        if (c) {
            c.failures++;
            if (c.failures >= CIRCUIT_THRESHOLD) {
                c.openUntil = Date.now() + CIRCUIT_COOLDOWN;
                console.warn(`[CircuitBreaker] ${name} OPEN — ${c.failures} failures, cooldown ${CIRCUIT_COOLDOWN / 1000}s`);
            }
        }
    },

    // ── Retry wrapper with circuit breaker gate ──
    async _fetchWithRetry(name, fetchFn, maxRetries = 1) {
        // Gate: if circuit is open, skip entirely (no timeout wait)
        if (this._isCircuitOpen(name)) {
            console.warn(`[CircuitBreaker] ${name} skipped — circuit open`);
            return null;
        }

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await fetchFn();
                this._recordSuccess(name);
                return result;
            } catch (error) {
                const isRetryable = ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED', 'EAI_AGAIN'].includes(error.code)
                    || (error.response && error.response.status >= 500);
                if (attempt < maxRetries && isRetryable) {
                    console.warn(`${name} attempt ${attempt + 1} failed (${error.code || error.response?.status}), retrying...`);
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                console.error(`${name} fetch failed:`, error.code || error.message || '(unknown)');
                this._recordFailure(name);
                return null;
            }
        }
        return null;
    },

    // 1. 7Timer! (Astro) — ~50km 해상도, 0.5° 그리드 캐시
    async fetch7Timer(lat, lon) {
        return _gridFetch('7timer', lat, lon, () =>
            this._fetchWithRetry('7Timer', async () => {
                const url = `https://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=astro&output=json`;
                const response = await axios.get(url, { timeout: 10000 });
                return response.data;
            })
        );
    },

    // 2. Open-Meteo — ~11km 해상도, 0.1° 그리드 캐시
    async fetchOpenMeteo(lat, lon, models = null) {
        return _gridFetch('openmeteo', lat, lon, () =>
            this._fetchWithRetry('Open-Meteo', async () => {
                const vars = [
                    'temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'cloud_cover',
                    'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
                    'wind_speed_10m', 'wind_speed_250hPa', 'cape',
                    'boundary_layer_height', 'skin_temperature',
                    'temperature_1000hPa', 'temperature_925hPa', 'temperature_850hPa',
                    'temperature_700hPa', 'temperature_500hPa', 'temperature_300hPa',
                    'temperature_250hPa', 'temperature_200hPa',
                    'wind_speed_1000hPa', 'wind_speed_925hPa', 'wind_speed_850hPa',
                    'wind_speed_700hPa', 'wind_speed_500hPa', 'wind_speed_300hPa',
                    'wind_speed_250hPa', 'wind_speed_200hPa'
                ].join(',');

                let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${vars}&forecast_days=7&timezone=auto`;

                if (models && models !== 'best_match') {
                    url += `&models=${Array.isArray(models) ? models.join(',') : models}`;
                }

                const response = await axios.get(url, { timeout: 15000 });
                return response.data;
            })
        );
    },

    // 3. Met.no — ~10km 해상도, 0.1° 그리드 캐시
    async fetchMetNo(lat, lon) {
        return _gridFetch('metno', lat, lon, () =>
            this._fetchWithRetry('Met.no', async () => {
                const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': `ClearSky-App/2.0 (${process.env.CONTACT_EMAIL || 'support@clearsky.kr'})`
                    },
                    timeout: 8000
                });
                return response.data;
            })
        );
    },

    // 4. AirQuality — ~28km 해상도, 0.2° 그리드 캐시
    async fetchAirQuality(lat, lon) {
        return _gridFetch('airquality', lat, lon, () => {
            if (this._isCircuitOpen('AirQuality')) {
                console.warn('[CircuitBreaker] AirQuality skipped — circuit open');
                return Promise.resolve(null);
            }

            const base = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&forecast_days=5&timezone=auto&hourly=`;
            const varSets = [
                'pm2_5,aerosol_optical_depth',
                'pm2_5,aerosol_optical_depth_550nm',
                'pm2_5',
            ];
            const tryNext = async (idx) => {
                if (idx >= varSets.length) {
                    console.warn('AirQuality: all variable sets exhausted (API schema changed?)');
                    return null;
                }
                try {
                    const response = await axios.get(base + varSets[idx], { timeout: 10000 });
                    this._recordSuccess('AirQuality');
                    return response.data;
                } catch (e) {
                    if (e.response && e.response.status === 400) return tryNext(idx + 1);
                    console.error('AirQuality fetch failed:', e.code || e.message || '(unknown)');
                    this._recordFailure('AirQuality');
                    return null;
                }
            };
            return tryNext(0);
        });
    },

    // 5. KMA 기상청 초단기예보 — 5km 격자, 0.05° 그리드 캐시
    async fetchKMA(lat, lon) {
        const KmaService = require('./kmaService');
        if (!KmaService.isKorea(lat, lon)) return null;
        if (!process.env.KMA_API_KEY) return null;
        return _gridFetch('kma', lat, lon, () =>
            this._fetchWithRetry('KMA', () => KmaService.fetchUltraSrtFcst(lat, lon))
        );
    },

    // 6. Ensemble — ~28km 해상도, 0.2° 그리드 캐시
    async fetchEnsembleCloud(lat, lon) {
        const EnsembleService = require('./ensembleService');
        return _gridFetch('ensemble', lat, lon, () =>
            this._fetchWithRetry('Ensemble', () => EnsembleService.fetchEnsembleCloud(lat, lon))
        );
    },

    // 7. METAR — 공항 기준 ~22km, 0.2° 그리드 캐시
    async fetchMetar(lat, lon) {
        const MetarService = require('./metarService');
        return _gridFetch('metar', lat, lon, () =>
            this._fetchWithRetry('METAR', () => MetarService.fetchNearbyMetar(lat, lon))
        );
    },

    // 8. GK2A 천리안위성 2A호 — satellite cloud/aerosol observation (East Asia, API key required)
    async fetchGK2A(lat, lon) {
        const GK2AService = require('./gk2aService');
        if (!GK2AService.isInCoverage(lat, lon)) return null;
        if (!process.env.GK2A_API_KEY) return null;
        return this._fetchWithRetry('GK2A', () => GK2AService.fetchSatelliteData(lat, lon));
    },

    // 9. 라디오존데 고층관측 — real measured vertical profiles (Korea, apihub API key required)
    async fetchRadiosonde(lat, lon) {
        const RadiosondeService = require('./radiosondeService');
        if (!RadiosondeService.isKorea(lat, lon)) return null;
        if (!process.env.KMA_UPP_API_KEY) return null;
        return this._fetchWithRetry('Radiosonde', () => RadiosondeService.fetchProfile(lat, lon));
    }
};

module.exports = ProviderService;
