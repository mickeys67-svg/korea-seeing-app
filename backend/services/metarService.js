const axios = require('axios');

// ═══ AviationWeather.gov METAR Service ═══
// 전세계 공항 실측 구름 관측 데이터
// 무료, API키 불필요, JSON 지원
// 엔드포인트: https://aviationweather.gov/api/data/metar

const METAR_BASE = 'https://aviationweather.gov/api/data/metar';

// METAR 구름 코드 → oktas (0-8)
const COVER_TO_OKTAS = {
    'CLR': 0, 'SKC': 0, 'CAVOK': 0, 'NCD': 0, 'NSC': 0,
    'FEW': 2,   // 1-2 oktas
    'SCT': 4,   // 3-4 oktas
    'BKN': 6,   // 5-7 oktas
    'OVC': 8,   // 8 oktas
    'VV': 8     // Vertical Visibility = obscured = worst
};

/**
 * lat/lon에서 ±1도 bbox 생성
 * @param {number} lat
 * @param {number} lon
 * @returns {string} "lat0,lon0,lat1,lon1"
 */
function makeBbox(lat, lon) {
    const d = 1.0; // ±1도 ≈ ±111km
    return `${(lat - d).toFixed(2)},${(lon - d).toFixed(2)},${(lat + d).toFixed(2)},${(lon + d).toFixed(2)}`;
}

/**
 * METAR 응답에서 최악 구름 커버를 oktas로 변환
 * 여러 레이어 중 가장 나쁜(높은) 값 사용
 * @param {object} metar - METAR JSON 객체
 * @returns {number} oktas (0-8)
 */
function parseCloudOktas(metar) {
    // 1) clouds 배열이 있으면 최악 커버 사용
    if (metar.clouds && Array.isArray(metar.clouds) && metar.clouds.length > 0) {
        let worstOktas = 0;
        for (const layer of metar.clouds) {
            const oktas = COVER_TO_OKTAS[layer.cover] ?? 0;
            if (oktas > worstOktas) worstOktas = oktas;
        }
        return worstOktas;
    }

    // 2) top-level cover 필드 사용
    if (metar.cover) {
        return COVER_TO_OKTAS[metar.cover] ?? 0;
    }

    // 3) 비어있는 clouds 배열 = 맑음
    return 0;
}

/**
 * 주어진 좌표 근처 METAR 데이터 조회
 * @param {number} lat
 * @param {number} lon
 * @returns {{ oktas: number, stationId: string, obsTime: string, distance: number } | null}
 */
async function fetchNearbyMetar(lat, lon) {
    const bbox = makeBbox(lat, lon);
    const url = `${METAR_BASE}?bbox=${bbox}&format=json&hours=2`;

    const response = await axios.get(url, {
        timeout: 8000,
        headers: {
            'User-Agent': 'ClearSky-App/3.3 (support@clearsky.kr)'
        },
        // 204 No Content = 데이터 없음, axios는 이를 에러로 처리하지 않음
        validateStatus: (status) => status === 200 || status === 204
    });

    // 204 또는 빈 응답
    if (response.status === 204 || !response.data || !Array.isArray(response.data) || response.data.length === 0) {
        console.log(`[METAR] No stations found near ${lat.toFixed(2)},${lon.toFixed(2)}`);
        return null;
    }

    const metars = response.data;

    // 가장 가까운 스테이션 찾기 (Haversine 근사)
    let closest = null;
    let minDist = Infinity;

    for (const m of metars) {
        if (m.lat == null || m.lon == null) continue;
        // 간단한 거리 근사 (도 단위, 고위도 보정 불필요 — 대부분 ±1도 이내)
        const dlat = m.lat - lat;
        const dlon = (m.lon - lon) * Math.cos(lat * Math.PI / 180);
        const dist = Math.sqrt(dlat * dlat + dlon * dlon) * 111; // km 근사

        if (dist < minDist) {
            minDist = dist;
            closest = m;
        }
    }

    if (!closest) return null;

    const oktas = parseCloudOktas(closest);
    const stationId = closest.icaoId || closest.id || 'UNKNOWN';
    // reportTime(ISO 문자열) 우선, 없으면 obsTime(Unix초) 변환, 둘 다 없으면 현재 시각
    const obsTime = closest.reportTime
        || (closest.obsTime ? new Date(closest.obsTime * 1000).toISOString() : new Date().toISOString());

    console.log(`[METAR] ${stationId}: ${closest.cover || 'N/A'} → ${oktas} oktas (${minDist.toFixed(0)}km away)`);

    return {
        oktas,          // 0-8 (이미 scoringService 스케일과 동일!)
        stationId,
        obsTime,
        distance: Math.round(minDist),
        cover: closest.cover || null,
        clouds: closest.clouds || [],
        visib: closest.visib || null
    };
}

module.exports = {
    fetchNearbyMetar,
    parseCloudOktas,
    COVER_TO_OKTAS
};
