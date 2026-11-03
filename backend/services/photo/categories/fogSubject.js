/**
 * v5.0 Photo Guide — Fog / Mist as Subject
 *
 * **안개는 피사체**. WMO 복사안개 예측 공식 + 사진 연출 관점.
 *
 * 물리 조건 (점수 ↑):
 *   - dewPointSpread < 2°C → 포화 근접
 *   - humidity > 95% → 포화
 *   - wind10m < 2 m/s → 분산 억제
 *   - cloud_cover_low < 30% → 복사 냉각
 *   - hour ∈ [4, 9] → 새벽
 *   - boundary_layer_height < 300m → 역전층 (미사용, Open-Meteo 기본에 있음)
 *
 * 사진 보너스:
 *   - 일출 직후(일출 ~ +90분) → 황금 안개 (backlit)
 *   - 고도 200-800m → 운해 가능성
 *   - 해안 + 해수온-기온 차 → 해무
 *
 * Output: score, grade, fogType, bestSubjects
 */
const {
    safeNum,
    clamp,
    gaussian,
    linRamp,
    invLinRamp,
    rawToScore100,
    scoreToGrade,
    weightedAvg,
    getLocalHour,
    isCoastalKorea,
    getElevationCategory,
} = require('./_shared');

// ─── Fog type 판정 ────────────────────────────────────────────
/**
 * Radiation fog — 복사 안개 (새벽, 맑은 밤, 약한 바람)
 * Advection fog — 이류 안개 (해무, 따뜻한 공기 + 찬 표면)
 * Valley fog    — 계곡 안개 (골짜기 역전층)
 * Upslope       — 산악 운해
 */
function detectFogType(w, context, hour) {
    const dewSpread = safeNum(w.dewPointSpread, 10);
    const wind      = safeNum(w.windSpeed, 5);
    const humidity  = safeNum(w.relativeHumidity, 60);
    const cloudLow  = safeNum(w.cloudCoverLow, 50);
    const lat       = context?.lat ?? 37;
    const lon       = context?.lon ?? 127;
    const elev      = context?.elevation ?? 0;

    // 새벽 + 맑은 밤 + 약풍 → 복사
    if (hour >= 3 && hour <= 9 && wind < 3 && cloudLow < 30 && dewSpread < 3) {
        return 'radiation';
    }
    // 해안 + 높은 습도 → 해무 (advection)
    if (isCoastalKorea(lat, lon) && humidity > 90 && wind >= 2 && wind < 8) {
        return 'advection';
    }
    // 산악 + 포화 → 운해/upslope
    if (elev >= 500 && humidity > 93 && dewSpread < 2) {
        return 'upslope';
    }
    // 계곡 (저지대) + 복사 조건 완화
    if (elev < 300 && hour >= 3 && hour <= 10 && wind < 2.5 && dewSpread < 3) {
        return 'valley';
    }
    return null;
}

// ─── 서브장르 매칭 ────────────────────────────────────────────
// subject의 score는 '어떤 피사체를 먼저 추천할지' 정렬·선택용 우선순위 가중치다.
// 화면에 숫자로 표시되지 않는다(프론트는 subject.id만 사용). 측정값/분석값 아님.
function matchSubjects(w, context, fogType, fogScore) {
    const subjects = [];
    const solar = context?.solar;
    const elev  = context?.elevation ?? 0;
    const isBacklitMoment = solar?.isGoldenHour && solar?.phase === 'goldenHourDawn';

    if (fogScore < 0.3) return subjects;

    // Forest fog (backlit)
    if (isBacklitMoment && fogType === 'radiation') {
        subjects.push({ id: 'backlit-fog', score: 0.95 });
    }
    if (fogType === 'radiation' || fogType === 'valley') {
        subjects.push({ id: 'forest-fog',  score: 0.85 });
        subjects.push({ id: 'valley-mist', score: fogType === 'valley' ? 0.9 : 0.65 });
    }
    if (fogType === 'advection') {
        subjects.push({ id: 'sea-fog', score: 0.9 });
    }
    if (fogType === 'upslope' || (elev >= 500 && fogScore > 0.6)) {
        subjects.push({ id: 'cloud-sea', score: 0.92 });
    }
    if (solar?.isGoldenHour && fogScore > 0.5) {
        subjects.push({ id: 'golden-mist', score: 0.88 });
    }

    subjects.sort((a, b) => b.score - a.score);
    return subjects.slice(0, 5);
}

// ─── 메인 계산 ────────────────────────────────────────────────
function calculate(slot, context) {
    const w = slot.weather || slot;

    const dewSpread = safeNum(w.dewPointSpread, 10);
    const humidity  = safeNum(w.relativeHumidity, 60);
    const wind      = safeNum(w.windSpeed, 5);
    const cloudLow  = safeNum(w.cloudCoverLow, 50);
    const precipProb= safeNum(w.precipProb, 0);
    const visibility= safeNum(w.visibility, 20000);

    const utcOffset = context?.utcOffsetSeconds ?? 0;
    const hour = getLocalHour(slot.time, utcOffset);

    // ─── 물리 조건 점수 ─────────────────────────────────────
    // 1) Dew point spread — 낮을수록 좋음 (0→1, 5→0)
    const dewScore = invLinRamp(dewSpread, 0.5, 5);

    // 2) Humidity — ≥95% 포화, 85% 이하는 약함
    const humidityScore = linRamp(humidity, 85, 98);

    // 3) Wind — <2m/s 이상적, >5 이상 분산
    const windScore = invLinRamp(wind, 1, 5);

    // 4) Cloud low (복사 냉각) — <30% 좋음
    const clearNightScore = invLinRamp(cloudLow, 20, 60);

    // 5) 새벽 시간대 보너스
    const hourScore = (hour != null && hour >= 3 && hour <= 9)
        ? gaussian(hour, 6, 2)
        : 0.2;

    // 6) Visibility — 이미 안개가 깔렸다면 visibility 급락. 이 자체가 피사체 있음의 증거.
    // vis < 5km → 실제 안개 발생 중 → 최대 가산
    const visibilityDropScore = visibility < 3000 ? 1.0
                            : visibility < 8000  ? 0.7
                            : visibility < 15000 ? 0.3
                            : 0.1;

    // ─── 물리적 fog 가능성 점수 ─────────────────────────────
    const physicsRaw = weightedAvg([
        { value: dewScore,        weight: 0.25 },
        { value: humidityScore,   weight: 0.20 },
        { value: windScore,       weight: 0.15 },
        { value: clearNightScore, weight: 0.10 },
        { value: hourScore,       weight: 0.10 },
        { value: visibilityDropScore, weight: 0.20 },
    ]);

    // ─── Fog type 판정 ───────────────────────────────────────
    const fogType = detectFogType(w, context, hour);

    // ─── 사진 연출 가산 ─────────────────────────────────────
    let photoBonus = 1.0;
    const solar = context?.solar;
    if (solar?.isGoldenHour && physicsRaw > 0.4) {
        photoBonus = 1.25; // 황금 안개
    } else if (solar?.phase === 'goldenHourDawn') {
        photoBonus = 1.15;
    } else if (solar?.isBlueHour) {
        photoBonus = 1.05;
    }

    // ─── 강수 패널티 (폭우 중엔 안개 촬영 불리) ─────────────
    const rainPenalty = precipProb > 70 ? 0.5
                    :  precipProb > 40 ? 0.8
                    :  1.0;

    const raw = clamp(physicsRaw * photoBonus * rainPenalty, 0, 1);
    const score = rawToScore100(raw);
    const grade = scoreToGrade(score);

    const bestSubjects = matchSubjects(w, context, fogType, physicsRaw);

    return {
        score,
        grade,
        raw: Math.round(raw * 1000) / 1000,
        fogType,
        bestSubjects,
        breakdown: {
            dewSpread:        { score: dewScore,         value: dewSpread, label: 'Dew Point Spread' },
            humidity:         { score: humidityScore,    value: humidity,  label: 'Humidity' },
            wind:             { score: windScore,        value: wind,      label: 'Wind Calm' },
            clearNight:       { score: clearNightScore,  value: cloudLow,  label: 'Clear Sky (radiation cooling)' },
            dawnHour:         { score: hourScore,        value: hour,      label: 'Dawn Hour' },
            visibilityDrop:   { score: visibilityDropScore, value: visibility, label: 'Fog Already Forming' },
        },
        factors: {
            photoBonus,
            rainPenalty,
            phase: solar?.phase || null,
        },
    };
}

module.exports = {
    calculate,
    detectFogType,
    matchSubjects,
};
