const axios = require('axios');

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

    // 1. 7Timer! (Astro) - Naturally covers ~8 days
    async fetch7Timer(lat, lon) {
        return this._fetchWithRetry('7Timer', async () => {
            const url = `https://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=astro&output=json`;
            const response = await axios.get(url, { timeout: 10000 });
            return response.data;
        });
    },

    // 2. Open-Meteo (Standard + Ensemble Support, Extended to 7 days)
    async fetchOpenMeteo(lat, lon, models = null) {
        return this._fetchWithRetry('Open-Meteo', async () => {
            const vars = [
                'temperature_2m', 'relative_humidity_2m', 'cloud_cover',
                'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
                'wind_speed_10m', 'wind_speed_250hPa', 'cape',
                'boundary_layer_height', 'skin_temperature',
                // Pressure-level variables for USP physics model (vertical profile)
                'temperature_1000hPa', 'temperature_925hPa', 'temperature_850hPa',
                'temperature_700hPa', 'temperature_500hPa', 'temperature_300hPa',
                'temperature_250hPa', 'temperature_200hPa',
                'wind_speed_1000hPa', 'wind_speed_925hPa', 'wind_speed_850hPa',
                'wind_speed_700hPa', 'wind_speed_500hPa', 'wind_speed_300hPa',
                'wind_speed_200hPa'
            ].join(',');

            let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${vars}&forecast_days=7&timezone=auto`;

            if (models && models !== 'best_match') {
                url += `&models=${Array.isArray(models) ? models.join(',') : models}`;
            }

            const response = await axios.get(url, { timeout: 15000 });
            return response.data;
        });
    },

    // 3. Met.no (Slightly shorter range, but good for local correction)
    async fetchMetNo(lat, lon) {
        return this._fetchWithRetry('Met.no', async () => {
            const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': `ClearSky-App/2.0 (${process.env.CONTACT_EMAIL || 'support@clearsky.kr'})`
                },
                timeout: 8000
            });
            return response.data;
        });
    },

    // 4. Open-Meteo Air Quality — sliding fallback + circuit breaker
    // 400 = API alive but variable name changed → don't trip circuit
    // Network error = API down → trip circuit
    async fetchAirQuality(lat, lon) {
        if (this._isCircuitOpen('AirQuality')) {
            console.warn('[CircuitBreaker] AirQuality skipped — circuit open');
            return null;
        }

        const base = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&forecast_days=5&timezone=auto&hourly=`;
        // Try variable sets in order: current → legacy → minimal
        const varSets = [
            'pm2_5,aerosol_optical_depth',
            'pm2_5,aerosol_optical_depth_550nm',
            'pm2_5',
        ];
        for (const vars of varSets) {
            try {
                const response = await axios.get(base + vars, { timeout: 10000 });
                this._recordSuccess('AirQuality');
                return response.data;
            } catch (e) {
                if (e.response && e.response.status === 400) continue; // schema change → try next, don't trip circuit
                console.error('AirQuality fetch failed:', e.code || e.message || '(unknown)');
                this._recordFailure('AirQuality');
                return null; // network error → give up
            }
        }
        // All 400s = API is alive but all variable names invalid. Don't trip circuit.
        console.warn('AirQuality: all variable sets exhausted (API schema changed?)');
        return null;
    },

    // 5. KMA 기상청 초단기예보 (Korea only — 30min update, 6h forecast)
    async fetchKMA(lat, lon) {
        const KmaService = require('./kmaService');
        if (!KmaService.isKorea(lat, lon)) return null;
        if (!process.env.KMA_API_KEY) return null;
        return this._fetchWithRetry('KMA', () => KmaService.fetchUltraSrtFcst(lat, lon));
    },

    // 6. Open-Meteo Ensemble — multi-model cloud probability (global, free, no key)
    async fetchEnsembleCloud(lat, lon) {
        const EnsembleService = require('./ensembleService');
        return this._fetchWithRetry('Ensemble', () => EnsembleService.fetchEnsembleCloud(lat, lon));
    },

    // 7. METAR — airport ground-truth cloud observation (global, free, no key)
    async fetchMetar(lat, lon) {
        const MetarService = require('./metarService');
        return this._fetchWithRetry('METAR', () => MetarService.fetchNearbyMetar(lat, lon));
    }
};

module.exports = ProviderService;
