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
 * raw Open-Meteo 응답을 시각으로 조회 가능한 인덱스로 변환.
 * photoService가 weather forecast slot(ws.time = targetDate.toISOString(), 진짜 UTC)과
 * 시간대로 join할 때 사용한다.
 *
 * 과거 버그: Map 키를 OM의 현지 벽시계 문자열("2026-11-03T18:00")로 쓰고,
 * 조회는 ws.time(진짜 UTC "…T18:37:22.000Z")로 해서 형식이 달라 항상 불일치 →
 * photo 변수(visibility·강수·UV·돌풍·isDay)가 전부 null → isDay가 늘 밤/낮 오판,
 * 장노출·야간 관련 추천이 전혀 안 떴다.
 * 수정: OM 현지 문자열을 응답의 utc_offset_seconds로 진짜 instant(epoch)로 바꿔 저장하고,
 * 조회 시 가장 가까운 시각을 집는다. 정각이 아닌 슬롯·반시간 오프셋 지역도 올바르게 매칭된다.
 *
 * 통합 응답에는 best_match 단일 모델 변수만 들어있고, suffix는 없다.
 *
 * @returns {{ size:number, get:(timeLike:(string|Date))=>object|null }}
 */
function buildPhotoIndex(raw) {
    const entries = [];
    if (!raw || !raw.hourly || !Array.isArray(raw.hourly.time)) {
        return { size: 0, get: () => null };
    }
    const h = raw.hourly;
    const offMs = (raw.utc_offset_seconds || 0) * 1000;
    for (let i = 0; i < h.time.length; i++) {
        const s = h.time[i];
        if (!s) continue;
        const timePart = s.length > 10 ? s.slice(10) : '';
        const hasZone = /[zZ]/.test(timePart) || /[+-]\d\d:?\d\d$/.test(timePart);
        // naive 현지 문자열 → 벽시계를 UTC로 파싱 후 offset을 빼 진짜 instant로
        const t = hasZone ? Date.parse(s) : (Date.parse(s + 'Z') - offMs);
        if (Number.isNaN(t)) continue;
        entries.push({
            t,
            vars: {
                visibility:        h.visibility?.[i] ?? null,                  // m
                precipitation:     h.precipitation?.[i] ?? null,                // mm
                precipProb:        h.precipitation_probability?.[i] ?? null,    // %
                windGusts10m:      h.wind_gusts_10m?.[i] ?? null,              // m/s
                uvIndex:           h.uv_index?.[i] ?? null,
                surfacePressure:   h.surface_pressure?.[i] ?? null,            // hPa
                isDay:             h.is_day?.[i] ?? null,                      // 0/1
            },
        });
    }
    entries.sort((a, b) => a.t - b.t);
    return {
        size: entries.length,
        get(timeLike) {
            if (entries.length === 0) return null;
            const target = timeLike instanceof Date ? timeLike.getTime() : Date.parse(timeLike);
            if (Number.isNaN(target)) return null;
            let best = null;
            let bestDiff = Infinity;
            for (const e of entries) {
                const d = Math.abs(e.t - target);
                if (d < bestDiff) { bestDiff = d; best = e; }
            }
            // OM은 매시 정각, weather 슬롯은 3h 간격. 2시간 넘게 벌어지면 범위 밖 → 데이터 없음.
            return bestDiff <= 2 * 3600 * 1000 ? best.vars : null;
        },
    };
}

module.exports = {
    fetchOpenMeteoForPhoto,
    buildPhotoIndex,
};
