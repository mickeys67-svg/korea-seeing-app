const axios = require('axios');

// ═══ KMA (기상청) 초단기예보 서비스 ═══
// 한국 좌표 전용 — 30분 갱신 실시간 구름/기상 데이터
// API: https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst

const KMA_BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';

// ═══ Lambert Conformal Conic 좌표 변환 ═══
// lat/lon → KMA 격자 (nx, ny) 5km×5km grid
// Ref: https://gist.github.com/fronteer-kr/14d7f779d52a21ac2f16
const LCC = {
    RE: 6371.00877,  // Earth radius (km)
    GRID: 5.0,       // Grid spacing (km)
    SLAT1: 30.0,     // Standard parallel 1 (°)
    SLAT2: 60.0,     // Standard parallel 2 (°)
    OLON: 126.0,     // Origin longitude (°)
    OLAT: 38.0,      // Origin latitude (°)
    XO: 43,          // Origin grid X
    YO: 136          // Origin grid Y
};

function latLonToGrid(lat, lon) {
    const DEG_RAD = Math.PI / 180.0;
    const re = LCC.RE / LCC.GRID;
    const slat1 = LCC.SLAT1 * DEG_RAD;
    const slat2 = LCC.SLAT2 * DEG_RAD;
    const olon = LCC.OLON * DEG_RAD;
    const olat = LCC.OLAT * DEG_RAD;

    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = (re * sf) / Math.pow(ro, sn);

    let ra = Math.tan(Math.PI * 0.25 + lat * DEG_RAD * 0.5);
    ra = (re * sf) / Math.pow(ra, sn);
    let theta = lon * DEG_RAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;

    return {
        nx: Math.floor(ra * Math.sin(theta) + LCC.XO + 0.5),
        ny: Math.floor(ro - ra * Math.cos(theta) + LCC.YO + 0.5)
    };
}

/**
 * 한국 좌표 판별 (33-39N, 124-132E)
 */
function isKorea(lat, lon) {
    return lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132;
}

/**
 * SKY 코드 → cloudScore (0-8)
 * SKY 1=맑음(~10%), 3=구름많음(~65%), 4=흐림(~90%)
 * @param {number} sky - KMA SKY code (1, 3, or 4)
 * @param {number} pty - KMA PTY code (0=없음, 1=비, 2=비/눈, 3=눈)
 * @returns {number} cloudScore 0-8
 */
function skyToCloudScore(sky, pty = 0, humidity = null) {
    // 강수 시 하늘 완전 차단
    if (pty > 0) return 7.5;

    switch (sky) {
        case 1: return 0.8;   // 맑음 → ~10%
        case 3: {
            // v3.1: 습도 기반 보간 — SKY=3 "구름많음"의 실제 두께 추정
            // 건조 → 얇은 권운일 가능성, 습함 → 두꺼운 구름일 가능성
            if (humidity == null || isNaN(humidity)) return 4.5; // null→중립
            if (humidity < 50) return 3.5;   // 건조→얇은 구름
            if (humidity < 70) return 4.5;   // 보통
            return 5.5;                       // 습함→두꺼운 구름
        }
        case 4: return 7.2;   // 흐림 → ~90%
        default: return null; // 알 수 없음
    }
}

/**
 * 초단기예보 base_time 계산
 * 매시 30분 발표, ~10분 후 이용 가능
 * @returns {{ baseDate: string, baseTime: string }}
 */
function getUltraSrtBaseTime() {
    // KST = UTC+9 — use UTC methods on shifted Date to avoid local timezone issues
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    let y = kst.getUTCFullYear();
    let m = kst.getUTCMonth() + 1;
    let d = kst.getUTCDate();
    let h = kst.getUTCHours();
    const min = kst.getUTCMinutes();

    // 발표 후 ~10분 필요: XX:40 이후에야 XX:30 데이터 조회 가능
    if (min < 40) {
        h = h - 1;
        if (h < 0) {
            h = 23;
            const prev = new Date(kst);
            prev.setUTCDate(prev.getUTCDate() - 1);
            y = prev.getUTCFullYear();
            m = prev.getUTCMonth() + 1;
            d = prev.getUTCDate();
        }
    }

    return {
        baseDate: `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`,
        baseTime: `${String(h).padStart(2, '0')}30`
    };
}

/**
 * 초단기예보 API 호출
 * @param {number} lat
 * @param {number} lon
 * @returns {Map<string, object>|null} fcstTime별 데이터 맵 or null
 */
async function fetchUltraSrtFcst(lat, lon) {
    const apiKey = process.env.KMA_API_KEY;
    if (!apiKey) return null;
    if (!isKorea(lat, lon)) return null;

    const { nx, ny } = latLonToGrid(lat, lon);
    const { baseDate, baseTime } = getUltraSrtBaseTime();

    // serviceKey를 URL에 직접 삽입 (axios params 인코딩 시 data.go.kr 401 발생 방지)
    const url = `${KMA_BASE}/getUltraSrtFcst?serviceKey=${apiKey}&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}&numOfRows=60&pageNo=1`;

    console.log(`[KMA] Fetching UltraSrtFcst: ${baseDate} ${baseTime} grid(${nx},${ny}) key=${'*'.repeat(6)}`);

    const response = await axios.get(url, { timeout: 8000 });
    const data = response.data;

    // 응답 검증
    const header = data?.response?.header;
    if (!header || header.resultCode !== '00') {
        console.warn(`[KMA] Error: ${header?.resultCode} ${header?.resultMsg}`);
        return null;
    }

    const items = data?.response?.body?.items?.item;
    if (!items || items.length === 0) {
        console.warn('[KMA] No items in response');
        return null;
    }

    // category+fcstTime별 그룹핑 → Map<'YYYYMMDDHHMM', { sky, pty, t1h, reh, wsd, ... }>
    const slotMap = new Map();
    for (const item of items) {
        const key = `${item.fcstDate}${item.fcstTime}`;
        if (!slotMap.has(key)) slotMap.set(key, {});
        const slot = slotMap.get(key);
        const val = parseFloat(item.fcstValue);

        switch (item.category) {
            case 'SKY': slot.sky = val; break;
            case 'PTY': slot.pty = val; break;
            case 'T1H': slot.t1h = val; break;
            case 'REH': slot.reh = val; break;
            case 'WSD': slot.wsd = val; break;
            case 'VEC': slot.vec = val; break;
            case 'RN1': slot.rn1 = item.fcstValue; break;  // "강수없음" 문자열 가능
            case 'LGT': slot.lgt = val; break;
        }
    }

    console.log(`[KMA] Parsed ${slotMap.size} time slots from UltraSrtFcst`);
    return slotMap;
}

/**
 * KMA 시간 슬롯에서 targetDate에 가장 가까운 데이터 찾기
 * @param {Map} kmaData - fetchUltraSrtFcst 반환값
 * @param {Date} targetDate - 찾고자 하는 시각
 * @returns {object|null} { sky, pty, t1h, reh, wsd, vec, ... }
 */
function findClosestSlot(kmaData, targetDate) {
    if (!kmaData || kmaData.size === 0) return null;

    let closest = null;
    let minDiff = Infinity;

    for (const [key, slot] of kmaData) {
        // key format: 'YYYYMMDDHHMM'
        const y = parseInt(key.substring(0, 4));
        const m = parseInt(key.substring(4, 6)) - 1;
        const d = parseInt(key.substring(6, 8));
        const h = parseInt(key.substring(8, 10));
        const min = parseInt(key.substring(10, 12));
        const slotDate = new Date(Date.UTC(y, m, d, h - 9, min)); // KST→UTC

        const diff = Math.abs(slotDate.getTime() - targetDate.getTime());
        if (diff < minDiff) {
            minDiff = diff;
            closest = slot;
        }
    }

    // 3시간(10800000ms) 이내만 매칭 (너무 먼 시간은 무시)
    if (minDiff > 3 * 60 * 60 * 1000) return null;

    return closest;
}

module.exports = {
    isKorea,
    latLonToGrid,
    skyToCloudScore,
    fetchUltraSrtFcst,
    findClosestSlot,
    getUltraSrtBaseTime  // for testing
};
