/**
 * v5.0 Photo Guide — Twilight & Solar Geometry Service
 *
 * astronomy-engine의 SearchAltitude로 civil/nautical/astronomical twilight 시각,
 * golden/blue hour window, 태양 방위를 계산.
 *
 * 기존 astronomyService.js는 무변경. 이 파일은 신규 독립 모듈.
 *
 * 참고값 (사진 분야 관행):
 *   Golden Hour:   Sun altitude −4° ~ +6°
 *   Blue Hour:     Sun altitude −6° ~ −4°
 *   Civil Dusk/Dawn:  Sun altitude −6° 교차 (end of civil twilight)
 *   Nautical:      −12°
 *   Astronomical:  −18°
 *
 * "Belt of Venus" 창: 일몰 후 15-25분 (sun altitude −3° ~ −6°), 반태양 방향
 */
const Astronomy = require('astronomy-engine');

/**
 * 지정 날짜 하루에 대한 twilight/golden/blue 윈도우 계산.
 * 관찰자 위치의 하루 전체를 훑어서 정확한 시각을 찾는다.
 *
 * @param {Date} localMidnightUTC - 해당 로컬 날짜의 0시를 UTC로 표현한 Date
 * @param {number} lat
 * @param {number} lon
 * @returns {object} twilight windows
 */
function calculateTwilightForDay(localMidnightUTC, lat, lon) {
    const observer = new Astronomy.Observer(lat, lon, 0);

    // 하루 전체(24h+여유) 창에서 각 고도 교차를 탐색
    const search = (direction, altDeg) => {
        try {
            const t = Astronomy.SearchAltitude(
                Astronomy.Body.Sun,
                observer,
                direction,
                localMidnightUTC,
                1.2, // 1.2일 범위
                altDeg
            );
            return t ? t.date.toISOString() : null;
        } catch (e) {
            return null;
        }
    };

    // +1: ascending (morning), -1: descending (evening)
    const astronomicalDawn = search(+1, -18); // 천문박명 시작
    const nauticalDawn     = search(+1, -12);
    const civilDawn        = search(+1, -6);  // 민간박명 시작 (블루아워 시작)
    const goldenHourDawnStart = search(+1, -4); // dawn golden hour lower bound
    const sunriseCalc      = search(+1,  0);  // 지평선 교차 (참고용; 기존 astronomyService와 분리)
    const goldenHourDawnEnd = search(+1, +6); // dawn golden hour upper bound

    const goldenHourDuskStart = search(-1, +6);
    const sunsetCalc          = search(-1,  0);
    const goldenHourDuskEnd   = search(-1, -4);
    const civilDusk           = search(-1, -6);
    const nauticalDusk        = search(-1, -12);
    const astronomicalDusk    = search(-1, -18);

    // Golden Hour / Blue Hour 윈도우 정의
    const goldenHourDawn = (goldenHourDawnStart && goldenHourDawnEnd)
        ? { start: goldenHourDawnStart, end: goldenHourDawnEnd }
        : null;

    const goldenHourDusk = (goldenHourDuskStart && goldenHourDuskEnd)
        ? { start: goldenHourDuskStart, end: goldenHourDuskEnd }
        : null;

    const blueHourDawn = (civilDawn && goldenHourDawnStart)
        ? { start: civilDawn, end: goldenHourDawnStart }
        : null;

    const blueHourDusk = (goldenHourDuskEnd && civilDusk)
        ? { start: goldenHourDuskEnd, end: civilDusk }
        : null;

    // Belt of Venus: 일몰 후 약 15-25분, sun altitude ≈ -3° ~ -6°
    const beltOfVenusStart = search(-1, -3);
    const beltOfVenus = (beltOfVenusStart && civilDusk)
        ? { start: beltOfVenusStart, end: civilDusk }
        : null;

    // Alpenglow: 일몰 직전 ±20분 (sun altitude +2° ~ -2°)
    const alpenGlowUpper = search(-1, +2);
    const alpenGlowLower = search(-1, -2);
    const alpenGlow = (alpenGlowUpper && alpenGlowLower)
        ? { start: alpenGlowUpper, end: alpenGlowLower }
        : null;

    return {
        date: localMidnightUTC.toISOString().split('T')[0],
        dawn: {
            astronomical: astronomicalDawn,
            nautical:     nauticalDawn,
            civil:        civilDawn,
            blueHour:     blueHourDawn,
            goldenHour:   goldenHourDawn,
            sunrise:      sunriseCalc,
        },
        dusk: {
            sunset:       sunsetCalc,
            goldenHour:   goldenHourDusk,
            blueHour:     blueHourDusk,
            beltOfVenus:  beltOfVenus,
            alpenGlow:    alpenGlow,
            civil:        civilDusk,
            nautical:     nauticalDusk,
            astronomical: astronomicalDusk,
        },
    };
}

/**
 * N일간 twilight 계산.
 *
 * @param {Date} startDate
 * @param {number} days
 * @param {number} lat
 * @param {number} lon
 * @param {number} utcOffsetSeconds
 * @returns {Array<object>}
 */
function getTwilightForecast(startDate, days, lat, lon, utcOffsetSeconds = 0) {
    const offsetMs = utcOffsetSeconds * 1000;
    const localRef = new Date(startDate.getTime() + offsetMs);
    const out = [];

    for (let i = 0; i < days; i++) {
        const localMidnightMs = Date.UTC(
            localRef.getUTCFullYear(),
            localRef.getUTCMonth(),
            localRef.getUTCDate() + i,
            0, 0, 0, 0
        );
        const midnightUTC = new Date(localMidnightMs - offsetMs);
        out.push(calculateTwilightForDay(midnightUTC, lat, lon));
    }
    return out;
}

/**
 * 특정 시각의 태양 방위각(azimuth, 0=북, 90=동)과 고도(altitude).
 * Sky Color의 촬영 방향 힌트 생성에 사용.
 */
function getSunPosition(isoTime, lat, lon) {
    try {
        const d = new Date(isoTime);
        const observer = new Astronomy.Observer(lat, lon, 0);
        const equ = Astronomy.Equator(Astronomy.Body.Sun, d, observer, true, true);
        const hor = Astronomy.Horizon(d, observer, equ.ra, equ.dec, 'normal');
        return {
            altitude: hor.altitude,
            azimuth:  hor.azimuth,
        };
    } catch (e) {
        return null;
    }
}

/**
 * 주어진 슬롯이 특정 window(start,end) 안에 있는지 판정.
 */
function isWithinWindow(isoTime, window) {
    if (!window || !window.start || !window.end) return false;
    const t = new Date(isoTime).getTime();
    const s = new Date(window.start).getTime();
    const e = new Date(window.end).getTime();
    if (isNaN(t) || isNaN(s) || isNaN(e)) return false;
    return t >= s && t <= e;
}

/**
 * 슬롯 시각에 대해 twilight 단계 태그 리턴.
 * 사진 장르 스코어러에서 빠르게 "현재 슬롯이 골든/블루/박명인가" 판정.
 */
function classifyTimePhase(isoTime, twilightDay) {
    if (!twilightDay) return 'unknown';
    const { dawn, dusk } = twilightDay;
    if (isWithinWindow(isoTime, dawn.goldenHour)) return 'goldenHourDawn';
    if (isWithinWindow(isoTime, dusk.goldenHour)) return 'goldenHourDusk';
    if (isWithinWindow(isoTime, dawn.blueHour))   return 'blueHourDawn';
    if (isWithinWindow(isoTime, dusk.blueHour))   return 'blueHourDusk';
    if (isWithinWindow(isoTime, dusk.beltOfVenus)) return 'beltOfVenus';

    const t = new Date(isoTime).getTime();
    const sunrise = dawn.sunrise ? new Date(dawn.sunrise).getTime() : null;
    const sunset  = dusk.sunset  ? new Date(dusk.sunset).getTime()  : null;
    const astroDawn = dawn.astronomical ? new Date(dawn.astronomical).getTime() : null;
    const astroDusk = dusk.astronomical ? new Date(dusk.astronomical).getTime() : null;

    if (sunrise != null && sunset != null && t >= sunrise && t <= sunset) return 'day';
    if (astroDawn != null && astroDusk != null) {
        if (t < astroDawn || t > astroDusk) return 'night'; // deep night
    }
    return 'twilight';
}

/**
 * 특정 슬롯에 대해 주/야 판정 및 태양 기하학을 함께 리턴.
 * skyColor 카테고리가 주로 사용.
 */
function getSolarContext(isoTime, twilightDay, lat, lon) {
    const phase = classifyTimePhase(isoTime, twilightDay);
    const sun = getSunPosition(isoTime, lat, lon);
    const isGolden = phase === 'goldenHourDawn' || phase === 'goldenHourDusk';
    const isBlue   = phase === 'blueHourDawn'   || phase === 'blueHourDusk';
    const isBelt   = phase === 'beltOfVenus';
    const isDay    = phase === 'day';
    const isNight  = phase === 'night';
    return {
        phase,
        sunAltitude: sun?.altitude ?? null,
        sunAzimuth:  sun?.azimuth  ?? null,
        isGoldenHour: isGolden,
        isBlueHour:   isBlue,
        isBeltOfVenus: isBelt,
        isDay,
        isNight,
    };
}

module.exports = {
    calculateTwilightForDay,
    getTwilightForecast,
    getSunPosition,
    isWithinWindow,
    classifyTimePhase,
    getSolarContext,
};
