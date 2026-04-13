/**
 * v5.0 Photo Guide — Open-Meteo 추가 변수 fetcher
 *
 * 기존 providerService.fetchOpenMeteo()의 변수 배열을 건드리지 않고,
 * photo 전용 변수만 별도 URL로 요청한다.
 *
 * 신규 변수 (7개):
 *   - visibility             (기상 가시거리, meter)
 *   - precipitation          (mm)
 *   - precipitation_probability (%)
 *   - wind_gusts_10m         (m/s)
 *   - uv_index               (0-11+)
 *   - surface_pressure       (hPa)
 *   - is_day                 (0/1)
 *
 * 또한 altitude는 current 응답의 elevation 필드에서 얻는다.
 *
 * 캐시: 자체 LRU, 키 prefix "photo_openmeteo"
 * TTL: 5분 (기존 openmeteo 그리드와 동일)
 */
// native fetch (Node 18+)

const _cache = new Map();
const _MAX = 100;
const _TTL = 5 * 60 * 1000; // 5 min
const _GRID_STEP = 0.1; // ~11km (Open-Meteo 실질 해상도)

function _gridKey(lat, lon) {
    const gLat = (Math.round(lat / _GRID_STEP) * _GRID_STEP).toFixed(3);
    const gLon = (Math.round(lon / _GRID_STEP) * _GRID_STEP).toFixed(3);
    return `photo_om_${gLat}_${gLon}`;
}

function _cacheGet(key) {
    const entry = _cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > _TTL) {
        _cache.delete(key);
        return undefined;
    }
    return entry.data;
}

function _cacheSet(key, data) {
    if (_cache.size >= _MAX && !_cache.has(key)) {
        const oldest = _cache.keys().next().value;
        _cache.delete(oldest);
    }
    _cache.set(key, { data, ts: Date.now() });
}

// Simple pending-request dedup
const _pending = new Map();

/**
 * Photo용 Open-Meteo 데이터 fetch.
 * 실패 시 null 반환 (photoService가 "제한 모드"로 계산).
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<object|null>} Open-Meteo raw response or null
 */
async function fetchOpenMeteoForPhoto(lat, lon) {
    const key = _gridKey(lat, lon);

    // 1. cache hit
    const cached = _cacheGet(key);
    if (cached !== undefined) return cached;

    // 2. pending dedup
    if (_pending.has(key)) return _pending.get(key);

    // 3. new request
    const vars = [
        'visibility',
        'precipitation',
        'precipitation_probability',
        'wind_gusts_10m',
        'uv_index',
        'surface_pressure',
        'is_day',
    ].join(',');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${vars}&forecast_days=4&timezone=auto`;

    const promise = (async () => {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
            const data = await response.json();
            if (data != null) _cacheSet(key, data);
            return data;
        } catch (error) {
            console.warn('[photo] fetchOpenMeteoForPhoto failed:', error.code || error.message || 'unknown');
            return null;
        }
    })();

    _pending.set(key, promise);
    promise.finally(() => _pending.delete(key));
    return promise;
}

/**
 * raw Open-Meteo 응답을 time-indexed map으로 변환.
 * photoService가 기존 weather forecast slot과 시간대로 join할 때 사용.
 *
 * @returns {Map<string, object>} time(ISO) → { visibility, precipitation, ... }
 */
function buildPhotoIndex(raw) {
    const out = new Map();
    if (!raw || !raw.hourly || !Array.isArray(raw.hourly.time)) return out;
    const h = raw.hourly;
    for (let i = 0; i < h.time.length; i++) {
        out.set(h.time[i], {
            visibility:        h.visibility?.[i] ?? null,                  // m
            precipitation:     h.precipitation?.[i] ?? null,                // mm
            precipProb:        h.precipitation_probability?.[i] ?? null,    // %
            windGusts10m:      h.wind_gusts_10m?.[i] ?? null,              // m/s
            uvIndex:           h.uv_index?.[i] ?? null,
            surfacePressure:   h.surface_pressure?.[i] ?? null,            // hPa
            isDay:             h.is_day?.[i] ?? null,                      // 0/1
        });
    }
    return out;
}

module.exports = {
    fetchOpenMeteoForPhoto,
    buildPhotoIndex,
};
