/**
 * v5.0 Photo Guide — Phenomena Slot Scorer
 *
 * phenomenaService는 30일 캘린더(월식/일식/슈퍼문/유성우)를 제공하고,
 * 이 모듈은 "지금 이 슬롯에서 관측 가능한 대기광학 현상"을 판정.
 *
 * Atmospheric Optics (기상 조건 기반 확률):
 *   - Rainbow: 태양 고도 < 42° + precipProb 20-50% + is_day
 *   - Fogbow: 안개 + 태양 가시
 *   - Halo 22°: cloudHigh > 40% (권운) + 태양 가시
 *   - Sun Pillar: 기온 < -5°C + 고층운 + 일출/일몰
 *   - Crepuscular Rays: cloudMid 부분운 + 일몰 ±30분
 *   - Belt of Venus: 일몰 후 +15~25분, 반태양 맑음
 *   - Alpenglow: 고도 >1000m + 일몰 ±20분
 *
 * Output: score, grade, opticalEvents[], linkedPhenomena[]
 */
const {
    safeNum,
    clamp,
    rawToScore100,
    scoreToGrade,
} = require('./_shared');

// ─── 개별 광학현상 판정 함수 ──────────────────────────────────
function checkRainbow(w, context) {
    const solar = context?.solar;
    const isDay = w.isDay !== 0;
    const precipProb = safeNum(w.precipProb, 0);
    const sunAlt = solar?.sunAltitude ?? -99;
    if (!isDay) return null;
    if (sunAlt <= 0 || sunAlt >= 42) return null;
    if (precipProb < 15 || precipProb > 70) return null;
    // 확률 = sweet spot 20-50%에서 peak
    const probability = precipProb >= 25 && precipProb <= 45 ? 0.7 :
                        precipProb >= 15 && precipProb <= 60 ? 0.45 : 0.25;
    return {
        id: 'rainbow',
        probability,
        direction: solar?.sunAzimuth != null
            ? `opposite-sun (az ${Math.round((solar.sunAzimuth + 180) % 360)}°)`
            : 'opposite-sun',
    };
}

function checkFogbow(w, context) {
    const visibility = safeNum(w.visibility, 20000);
    const humidity = safeNum(w.relativeHumidity, 60);
    const solar = context?.solar;
    if (visibility > 5000 || humidity < 90) return null;
    if (!solar || solar.sunAltitude == null || solar.sunAltitude < 0) return null;
    return {
        id: 'fogbow',
        probability: 0.4,
        direction: 'opposite-sun',
    };
}

function checkHalo22(w, context) {
    const cloudHigh = safeNum(w.cloudCoverHigh, 0);
    const cloudMid  = safeNum(w.cloudCoverMid, 0);
    const solar = context?.solar;
    if (cloudHigh < 40 || cloudHigh > 85) return null;
    if (cloudMid > 60) return null; // 중층운이 많으면 권운 가려짐
    if (!solar || solar.sunAltitude == null || solar.sunAltitude < 10) return null;
    return {
        id: 'halo-22',
        probability: cloudHigh >= 50 && cloudHigh <= 75 ? 0.6 : 0.4,
        direction: 'around-sun (22° radius)',
    };
}

function checkSunPillar(w, context) {
    const temp = safeNum(w.temp2m, 10);
    const cloudHigh = safeNum(w.cloudCoverHigh, 0);
    const solar = context?.solar;
    if (temp > -5) return null;
    if (cloudHigh < 30) return null;
    if (!solar) return null;
    if (!(solar.isGoldenHour || solar.isBlueHour)) return null;
    return {
        id: 'sun-pillar',
        probability: 0.55,
        direction: solar.sunAzimuth != null ? `sun direction (az ${Math.round(solar.sunAzimuth)}°)` : 'sun direction',
    };
}

function checkCrepuscularRays(w, context) {
    const cloudMid = safeNum(w.cloudCoverMid, 0);
    const solar = context?.solar;
    if (cloudMid < 20 || cloudMid > 70) return null;
    if (!solar) return null;
    if (!(solar.isGoldenHour || solar.phase === 'twilight')) return null;
    return {
        id: 'crepuscular-rays',
        probability: cloudMid >= 35 && cloudMid <= 55 ? 0.6 : 0.4,
        direction: solar.sunAzimuth != null ? `sun direction (az ${Math.round(solar.sunAzimuth)}°)` : 'sun direction',
    };
}

function checkBeltOfVenus(w, context) {
    const cloudLow = safeNum(w.cloudCoverLow, 0);
    const solar = context?.solar;
    if (!solar?.isBeltOfVenus) return null;
    if (cloudLow > 40) return null;
    return {
        id: 'belt-of-venus',
        probability: cloudLow < 20 ? 0.85 : 0.55,
        direction: solar.sunAzimuth != null
            ? `opposite-sun (az ${Math.round((solar.sunAzimuth + 180) % 360)}°)`
            : 'opposite-sun',
    };
}

function checkAlpenglow(w, context) {
    const elev = context?.elevation ?? 0;
    const solar = context?.solar;
    if (elev < 1000) return null;
    if (!solar) return null;
    if (!(solar.isGoldenHour || solar.isBlueHour)) return null;
    const cloudLow = safeNum(w.cloudCoverLow, 0);
    if (cloudLow > 60) return null;
    return {
        id: 'alpenglow',
        probability: 0.7,
        direction: 'mountain peaks',
    };
}

// ─── 메인 계산 ────────────────────────────────────────────────
function calculate(slot, context) {
    const w = slot.weather || slot;

    const checks = [
        checkRainbow(w, context),
        checkFogbow(w, context),
        checkHalo22(w, context),
        checkSunPillar(w, context),
        checkCrepuscularRays(w, context),
        checkBeltOfVenus(w, context),
        checkAlpenglow(w, context),
    ].filter(Boolean);

    // 이 슬롯과 매칭되는 캘린더 이벤트 (슈퍼문/월식/유성우)
    // context.phenomenaCalendar 에서 이 슬롯 하루와 같은 날짜 매칭
    const slotDate = slot.time ? slot.time.slice(0, 10) : null;
    const linkedPhenomena = [];
    if (slotDate && Array.isArray(context?.phenomenaCalendar)) {
        for (const ev of context.phenomenaCalendar) {
            if (ev.date === slotDate) linkedPhenomena.push(ev);
        }
    }

    // Score: 이벤트 확률의 가중 합
    let raw = 0;
    for (const c of checks) raw += c.probability * 0.2;
    for (const p of linkedPhenomena) {
        // 월식/슈퍼문 등이 이 날 있으면 크게 가산
        if (p.type === 'blood-moon') raw += 0.6;
        else if (p.type === 'supermoon') raw += 0.4;
        else if (p.type === 'meteor-shower') raw += 0.3;
        else if (p.type?.startsWith('lunar-eclipse')) raw += 0.5;
        else if (p.type?.startsWith('solar-eclipse')) raw += 0.45;
    }
    raw = clamp(raw, 0, 1);

    const score = rawToScore100(raw);
    const grade = scoreToGrade(score);

    return {
        score,
        grade,
        raw: Math.round(raw * 1000) / 1000,
        opticalEvents: checks,
        linkedPhenomena,
        breakdown: {
            opticalCount: checks.length,
            linkedCount:  linkedPhenomena.length,
        },
        factors: {
            slotDate,
        },
    };
}

module.exports = {
    calculate,
    checkRainbow,
    checkFogbow,
    checkHalo22,
    checkSunPillar,
    checkCrepuscularRays,
    checkBeltOfVenus,
    checkAlpenglow,
};
