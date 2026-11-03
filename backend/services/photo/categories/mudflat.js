/**
 * v5.0 Photo Guide — Mudflat (갯벌) Scorer
 *
 * 간조 + 황혼 × 반사.
 *
 * Phase A: 조수 데이터 없이 위치/시간 기반 "기회 점수" 제공.
 * Phase C: KHOA 바다누리 API 연동 후 실제 tide 곡선 기반 정확한 점수.
 *
 * 스코어링 요소:
 *   - tideProximity: 일몰/일출 ±90분 내 간조 저점 거리 (Phase C)
 *   - twilightOverlap: civil twilight 창과 겹침
 *   - reflectionBonus: wind <3m/s + 조수 저점 = 완벽한 수면 거울
 *   - cloudDrama: cloudMid 30-60% → 일몰 색이 물에 반사
 *
 * 지리 제약: 한국 서/남해안만 의미 있음 (서해안이 최대 갯벌 지대).
 *
 * Output: score, grade, tideEvent, reflectionWindow, bestSubjects
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
    isKoreaRegion,
    isCoastalKorea,
} = require('./_shared');

// ─── 서해안 판정 (갯벌 지대) ──────────────────────────────────
function isWesternCoast(lat, lon) {
    if (!isKoreaRegion(lat, lon)) return false;
    // 서해안: lon 124.5-127, lat 34-38
    return lon >= 124.5 && lon <= 127 && lat >= 34 && lat <= 38;
}

// ─── 남해안 판정 ──────────────────────────────────────────────
function isSouthernCoast(lat, lon) {
    if (!isKoreaRegion(lat, lon)) return false;
    // 남해안: lat 34-35.5, lon 126-130
    return lat >= 34 && lat <= 35.5 && lon >= 126 && lon <= 130;
}

// ─── 서브장르 매칭 ────────────────────────────────────────────
// subject의 score는 '어떤 피사체를 먼저 추천할지' 정렬·선택용 우선순위 가중치다.
// 화면에 숫자로 표시되지 않는다(프론트는 subject.id만 사용). 측정값/분석값 아님.
function matchSubjects(w, context, rawScore) {
    const subjects = [];
    if (rawScore < 0.3) return subjects;

    const wind = safeNum(w.windSpeed, 0);
    const cloudMid = safeNum(w.cloudCoverMid, 0);
    const cloudTotal = safeNum(w.cloudCoverTotal, 0);
    const solar = context?.solar;

    // Silhouette: 일몰/블루아워 + 지평선 뚜렷
    if ((solar?.isGoldenHour || solar?.isBlueHour) && cloudTotal < 80) {
        subjects.push({ id: 'silhouette', score: 0.9 });
    }
    // Reflection: 바람 약하고 수면 잔잔
    if (wind < 3 && (solar?.isGoldenHour || solar?.isBlueHour)) {
        subjects.push({ id: 'reflection', score: 0.95 });
    }
    // Horizon: 시정 좋고 낮 일반
    subjects.push({ id: 'horizon', score: 0.7 });
    // Tide pool: 세부
    if (wind < 4 && solar?.phase !== 'night') {
        subjects.push({ id: 'tide-pool', score: 0.75 });
    }
    // Textures (bare mud + oblique light)
    if (solar?.isGoldenHour || solar?.sunAltitude < 15) {
        subjects.push({ id: 'mud-texture', score: 0.8 });
    }

    subjects.sort((a, b) => b.score - a.score);
    return subjects.slice(0, 5);
}

// ─── 메인 계산 ────────────────────────────────────────────────
function calculate(slot, context) {
    const lat = context?.lat;
    const lon = context?.lon;

    // 지리 제약: 한국 서·남해안만 active
    if (lat == null || lon == null || (!isWesternCoast(lat, lon) && !isSouthernCoast(lat, lon))) {
        return {
            score: 0,
            grade: 'D',
            raw: 0,
            available: false,
            reason: 'not-coastal-korea',
            bestSubjects: [],
            breakdown: {},
            factors: { region: 'unavailable' },
        };
    }

    const w = slot.weather || slot;
    const wind       = safeNum(w.windSpeed, 5);
    const cloudMid   = safeNum(w.cloudCoverMid, 0);
    const cloudHigh  = safeNum(w.cloudCoverHigh, 0);
    const cloudLow   = safeNum(w.cloudCoverLow, 0);
    const cloudTotal = safeNum(w.cloudCoverTotal, cloudLow + cloudMid + cloudHigh);
    const precipProb = safeNum(w.precipProb, 0);
    const visibility = safeNum(w.visibility, 20000);
    const solar      = context?.solar;

    // ─── 1. Twilight overlap (tide 없이도 골든/블루 자체로 기회) ──
    let twilightOverlap;
    if (solar?.isGoldenHour) twilightOverlap = 1.0;
    else if (solar?.isBlueHour) twilightOverlap = 0.9;
    else if (solar?.isBeltOfVenus) twilightOverlap = 0.85;
    else if (solar?.phase === 'twilight') twilightOverlap = 0.6;
    else if (solar?.phase === 'day' && solar?.sunAltitude != null && solar.sunAltitude < 15) twilightOverlap = 0.55;
    else if (solar?.phase === 'day') twilightOverlap = 0.35;
    else twilightOverlap = 0.1;

    // ─── 2. Reflection quality ─────────────────────────────────
    // 바람이 잔잔할수록 물이 거울
    const reflectionQuality = invLinRamp(wind, 1, 5);

    // ─── 3. Cloud drama (일몰 색이 갯벌 반사) ──────────────────
    const cloudDrama = gaussian(cloudMid, 40, 25) * 0.6 + gaussian(cloudHigh, 40, 25) * 0.4;

    // ─── 4. Low cloud clear (지평선 차단 방지) ─────────────────
    const horizonClear = invLinRamp(cloudLow, 20, 60);

    // ─── 5. Visibility ─────────────────────────────────────────
    const visScore = clamp((visibility - 5000) / 15000, 0, 1);

    // ─── 가중 합산 ────────────────────────────────────────────
    // 조수(tide)는 실제 데이터 소스가 없어 제거했다(가짜 0.5 상수 금지).
    // KHOA 조수 API를 붙이기 전까지는 황혼·반사·구름·시정 같은 실측 기반
    // 요소로만 점수를 낸다. weightedAvg는 가중치 합으로 정규화하므로
    // 항목을 빼도 나머지 비율은 그대로 유지된다.
    const componentRaw = weightedAvg([
        { value: twilightOverlap,   weight: 0.30 },
        { value: reflectionQuality, weight: 0.20 },
        { value: cloudDrama,        weight: 0.15 },
        { value: horizonClear,      weight: 0.10 },
        { value: visScore,          weight: 0.10 },
    ]);

    // 강수 감점
    const rainPenalty = precipProb > 60 ? 0.4
                    :  precipProb > 30 ? 0.75
                    :  1.0;

    const raw = clamp(componentRaw * rainPenalty, 0, 1);
    const score = rawToScore100(raw);
    const grade = scoreToGrade(score);

    return {
        score,
        grade,
        raw: Math.round(raw * 1000) / 1000,
        available: true,
        region: isWesternCoast(lat, lon) ? 'west-coast' : 'south-coast',
        tideEvent: null,        // Phase C에서 채워짐
        reflectionWindow: null, // Phase C에서 채워짐
        bestSubjects: matchSubjects(w, context, componentRaw),
        breakdown: {
            twilightOverlap:   { score: twilightOverlap,   phase: solar?.phase || null, label: 'Twilight Overlap' },
            reflectionQuality: { score: reflectionQuality, value: wind,        label: 'Reflection (wind)' },
            cloudDrama:        { score: cloudDrama,        value: cloudMid,    label: 'Cloud Drama' },
            horizonClear:      { score: horizonClear,      value: cloudLow,    label: 'Horizon Clear' },
            visibility:        { score: visScore,          value: visibility,  label: 'Visibility' },
        },
        factors: {
            rainPenalty,
        },
    };
}

module.exports = {
    calculate,
    isWesternCoast,
    isSouthernCoast,
    matchSubjects,
};
