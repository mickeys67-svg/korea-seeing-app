/**
 * v5.0 Photo Guide — Open-Meteo 추가 변수 fetcher
 *
 * v5.4 비용 최적화: providerService.fetchOpenMeteo()의 통합 응답을 재사용한다.
 *  - 이전: 별도 OM URL 호출 (visibility/precip/gust/uv/pressure/isDay)
 *  - 현재: 메인 OM 호출에 위 7개 변수 통합 → 그리드 캐시 1회 히트로 끝
 *
 * 결과: photoService가 weather와 동시에 호출돼도 OM 외부 호출은 1번만 발생.
 */
const ProviderService = require('../providerService');

/**
 * Photo용 Open-Meteo 데이터 fetch.
 * 내부적으로 메인 OM 호출과 같은 그리드 캐시를 공유하므로 추가 비용 0.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<object|null>} Open-Meteo raw response (통합) or null
 */
async function fetchOpenMeteoForPhoto(lat, lon) {
    try {
        return await ProviderService.fetchOpenMeteo(lat, lon);
    } catch (error) {
        console.warn('[photo] fetchOpenMeteoForPhoto failed:', error.code || error.message || 'unknown');
        return null;
    }
}

/**
 * raw Open-Meteo 응답을 time-indexed map으로 변환.
 * photoService가 weather forecast slot과 시간대로 join할 때 사용.
 *
 * 통합 응답에는 best_match 단일 모델 변수만 들어있고, suffix는 없다.
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
