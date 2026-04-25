/**
 * v5.0 Photo Guide — Sky Color (Golden/Blue Hour) Scorer
 *
 * NOAA/MIT SunsetWx 기반 물리 모델:
 *   - 고층운(cirrus) 30-60%가 태양광을 반사 → 강렬한 오렌지
 *   - 저층운이 지평선을 막지 않아야 함
 *   - 에어로졸이 약간 있으면 Mie scattering으로 붉은색 증폭
 *   - 습도 40-70%가 최적 (너무 높으면 탁해짐)
 *
 * Output: 각 슬롯마다 score(0-100), grade, palette, colorDirection
 *
 * 평행 독립 모듈 — 기존 scoringService 무변경.
 */
const {
    gaussian,
    clamp,
    rawToScore100,
    scoreToGrade,
    safeNum,
} = require('./_shared');

// ─── Palette 결정 ─────────────────────────────────────────────
function paletteFromRaw(raw) {
    if (raw >= 0.75) return 'burning';   // 🔥 폭발적 오렌지-레드
    if (raw >= 0.55) return 'vivid';     // 🌅 선명한 골든
    if (raw >= 0.35) return 'pastel';    // 🌸 부드러운 핑크-퍼플
    return 'muted';                       // 🌫 약한 색
}

function paletteIcon(palette) {
    return {
        burning: '🔥',
        vivid:   '🌅',
        pastel:  '🌸',
        muted:   '🌫',
    }[palette] || '';
}

// ─── 태양 방위 → 촬영 방향 ────────────────────────────────────
function directionFromAzimuth(az) {
    if (az == null || !Number.isFinite(az)) return null;
    const norm = ((az % 360) + 360) % 360;
    const dirs = [
        { key: 'N',  min: 337.5, max: 360 },
        { key: 'N',  min: 0,     max: 22.5 },
        { key: 'NE', min: 22.5,  max: 67.5 },
        { key: 'E',  min: 67.5,  max: 112.5 },
        { key: 'SE', min: 112.5, max: 157.5 },
        { key: 'S',  min: 157.5, max: 202.5 },
        { key: 'SW', min: 202.5, max: 247.5 },
        { key: 'W',  min: 247.5, max: 292.5 },
        { key: 'NW', min: 292.5, max: 337.5 },
    ];
    for (const d of dirs) {
        if (norm >= d.min && norm < d.max) return d.key;
    }
    return 'N';
}

// ─── AOD 근사값 ───────────────────────────────────────────────
/**
 * Open-Meteo는 AOD를 직접 제공하지 않음.
 * 대신 visibility + humidity에서 간이 추정:
 *   - visibility 30km + humidity 50% → AOD ≈ 0.10 (clean)
 *   - visibility 10km + humidity 80% → AOD ≈ 0.35 (hazy)
 *   - visibility  5km               → AOD ≈ 0.60 (polluted)
 *
 * SunsetWx 모델의 "sweet spot" AOD ≈ 0.15 (약간의 에어로졸이 붉은색 증폭)
 */
function estimateAOD(visibilityM, humidity) {
    const vis = safeNum(visibilityM, 20000);
    const hum = safeNum(humidity, 60);
    // visibility만으로 대충: 30km → 0.08, 20km → 0.15, 10km → 0.30, 5km → 0.55
    let aod;
    if (vis >= 30000) aod = 0.08;
    else if (vis >= 20000) aod = 0.15;
    else if (vis >= 15000) aod = 0.20;
    else if (vis >= 10000) aod = 0.30;
    else if (vis >= 5000)  aod = 0.45;
    else aod = 0.65;
    // humidity 보정 (높을수록 습한 에어로졸 → 약간 증가)
    if (hum > 80) aod += 0.05;
    return aod;
}

// ─── 메인 계산 ────────────────────────────────────────────────
/**
 * Sky Color 점수 계산.
 *
 * @param {object} slot - weather 슬롯 { time, cloudCoverLow/Mid/High, relativeHumidity, visibility, precipProb, ... }
 * @param {object} context - { solar: { phase, sunAltitude, sunAzimuth, isGoldenHour, isBlueHour, isBeltOfVenus }, twilightDay }
 * @returns {object} { score, grade, raw, palette, paletteIcon, colorDirection, goldenHourWindow, blueHourWindow, beltOfVenusWindow, breakdown, factors, isActiveTime }
 */
function calculate(slot, context) {
    const w = slot.weather || slot;
    const solar = context?.solar || null;
    const twilightDay = context?.twilightDay || null;

    // ─── 원시 입력 ────────────────────────────────────────
    const cloudHigh = safeNum(w.cloudCoverHigh, 0);
    const cloudMid  = safeNum(w.cloudCoverMid,  0);
    const cloudLow  = safeNum(w.cloudCoverLow,  0);
    const humidity  = safeNum(w.relativeHumidity, 60);
    const visibility = safeNum(w.visibility, 20000); // m
    const precipProb = safeNum(w.precipProb, 0);
    const aod = estimateAOD(visibility, humidity);

    // ─── SunsetWx 가우시안 sweet-spot 점수 ─────────────────
    const highCloudOptimal = gaussian(cloudHigh, 45, 20);        // peak 45%, σ 20%
    const midCloudOptimal  = gaussian(cloudMid,  25, 15);        // peak 25%, σ 15%
    const lowCloudClear    = clamp((30 - cloudLow) / 30, 0, 1);  // <30% = 1, >30% 급감
    const aerosolOptimal   = gaussian(aod, 0.15, 0.10);          // peak 0.15
    const humidityOptimal  = gaussian(humidity, 55, 15);         // peak 55%
    const visibilityOk     = clamp((visibility - 5000) / 10000, 0, 1); // 5km→0, 15km→1

    // 강수 감점
    const rainPenalty = precipProb > 30 ? 0.5 : 1.0;

    // 태양 각도 보너스 — goldenHour 내면 full, 아니면 슬롯 역시 계산되지만 표시는 약하게
    let solarAngleBonus;
    let isActiveTime = false;
    if (solar) {
        if (solar.isGoldenHour) {
            solarAngleBonus = 1.0;
            isActiveTime = true;
        } else if (solar.isBlueHour || solar.isBeltOfVenus) {
            solarAngleBonus = 0.7;
            isActiveTime = true;
        } else if (solar.phase === 'twilight') {
            solarAngleBonus = 0.4;
        } else if (solar.phase === 'day') {
            solarAngleBonus = 0.15; // 대낮: sky color 거의 0
        } else {
            solarAngleBonus = 0.0;  // night
        }
    } else {
        solarAngleBonus = 0.3; // context 없으면 중립
    }

    // ─── 가중 합산 ────────────────────────────────────────
    const componentRaw =
        0.30 * highCloudOptimal +
        0.15 * midCloudOptimal +
        0.20 * lowCloudClear +
        0.15 * aerosolOptimal +
        0.10 * humidityOptimal +
        0.10 * visibilityOk;

    const raw = clamp(componentRaw * rainPenalty * solarAngleBonus, 0, 1);
    const score = rawToScore100(raw);
    const grade = scoreToGrade(score);
    const palette = paletteFromRaw(raw);

    // ─── 촬영 방향 (태양 방위 기준) ────────────────────────
    const colorDirection = directionFromAzimuth(solar?.sunAzimuth);

    // ─── Golden/Blue 윈도우 투과 (슬롯별 반복 피로 감소를 위해 context가 제공) ───
    const goldenHourWindow =
        (solar?.phase === 'goldenHourDawn' ? twilightDay?.dawn?.goldenHour :
         solar?.phase === 'goldenHourDusk' ? twilightDay?.dusk?.goldenHour : null)
        || twilightDay?.dusk?.goldenHour
        || twilightDay?.dawn?.goldenHour
        || null;

    const blueHourWindow =
        twilightDay?.dusk?.blueHour || twilightDay?.dawn?.blueHour || null;

    const beltOfVenusWindow = twilightDay?.dusk?.beltOfVenus || null;
    const alpenGlowWindow   = twilightDay?.dusk?.alpenGlow   || null;

    // ─── Breakdown (UI 6-bar 시각화용) ─────────────────────
    const breakdown = {
        highCloud:  { value: cloudHigh,  score: highCloudOptimal, label: 'High Cloud' },
        midCloud:   { value: cloudMid,   score: midCloudOptimal,  label: 'Mid Cloud' },
        lowCloud:   { value: cloudLow,   score: lowCloudClear,    label: 'Low Cloud (clearness)' },
        aerosol:    { value: aod,        score: aerosolOptimal,   label: 'Aerosol (AOD est.)' },
        humidity:   { value: humidity,   score: humidityOptimal,  label: 'Humidity' },
        visibility: { value: visibility, score: visibilityOk,     label: 'Visibility' },
    };

    // ─── Factor tags (suggestions 엔진이 참조) ─────────────
    const factors = {
        rainPenalty,
        solarAngleBonus,
        aodEstimated: aod,
        sunAltitude: solar?.sunAltitude ?? null,
        sunAzimuth:  solar?.sunAzimuth  ?? null,
        phase:       solar?.phase       ?? null,
    };

    return {
        score,
        grade,
        raw: Math.round(raw * 1000) / 1000,
        palette,
        paletteIcon: paletteIcon(palette),
        colorDirection,
        isActiveTime,
        goldenHourWindow,
        blueHourWindow,
        beltOfVenusWindow,
        alpenGlowWindow,
        breakdown,
        factors,
    };
}

module.exports = {
    calculate,
    paletteFromRaw,
    directionFromAzimuth,
    estimateAOD,
};
