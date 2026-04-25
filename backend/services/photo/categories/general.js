/**
 * v5.0 Photo Guide — General Photography Scorer
 *
 * 일반 풍경·거리·인물·건축·매크로·야생.
 * 사진가에게 "구름은 피사체, 안개는 분위기" — 기상은 스토리텔링의 오브제.
 *
 * 핵심 원칙:
 *   - Dramatic sky bonus: cloudHigh > cloudLow, 총운량 30-70% → 가산
 *   - Flat light penalty: cloudCover > 90% → 대비 소실
 *   - Rain rejection: precipProb > 60% → 하한 컷
 *   - Visibility bonus: > 15km → 망원·원경 가산
 *   - Humidity sweet spot: 40-70% → 색 포화도 최적
 *
 * Output: score, grade, bestSubjects[], moodTags[]
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
} = require('./_shared');

// ─── 서브장르 판정 ────────────────────────────────────────────
function matchSubjects(w, context) {
    const subjects = [];
    const isDay = w.isDay !== 0; // 명시적 0일 때만 밤
    const cloudTotal = safeNum(w.cloudCoverTotal, 0);
    const cloudHigh = safeNum(w.cloudCoverHigh, 0);
    const wind = safeNum(w.windSpeed, 0);
    const vis = safeNum(w.visibility, 20000);
    const hum = safeNum(w.relativeHumidity, 60);
    const precipProb = safeNum(w.precipProb, 0);
    const solar = context?.solar;

    // Portrait: diffuse high cloud or golden hour
    if ((cloudHigh >= 30 && cloudTotal < 90 && isDay && precipProb < 30)
        || solar?.isGoldenHour) {
        subjects.push({ id: 'portrait', score: solar?.isGoldenHour ? 0.95 : 0.75 });
    }
    // Street: any decent daylight with mood
    if (isDay && precipProb < 40 && vis > 8000) {
        subjects.push({
            id: 'street',
            score: cloudTotal >= 40 && cloudTotal <= 80 ? 0.85 : 0.65,
        });
    }
    // Architecture: blue hour or golden hour + clear
    if (solar?.isBlueHour || (solar?.isGoldenHour && cloudTotal < 50)) {
        subjects.push({ id: 'architecture', score: 0.9 });
    } else if (isDay && cloudTotal >= 20 && cloudTotal <= 70 && precipProb < 30) {
        subjects.push({ id: 'architecture', score: 0.7 });
    }
    // Macro: diffuse light, low wind, no rain
    if (cloudTotal >= 50 && cloudTotal <= 90 && wind < 4 && precipProb < 20 && isDay) {
        subjects.push({ id: 'macro', score: 0.85 });
    }
    // Wildlife: dawn/dusk, clear visibility
    if ((solar?.isGoldenHour || solar?.phase === 'day') && vis > 12000 && precipProb < 30) {
        subjects.push({ id: 'wildlife', score: solar?.isGoldenHour ? 0.9 : 0.65 });
    }
    // Landscape wide
    if (vis > 15000 && cloudTotal >= 20 && cloudTotal <= 80 && precipProb < 30 && isDay) {
        subjects.push({ id: 'landscape', score: 0.8 });
    }
    // Black & white drama (flat heavy overcast is GOOD for mono)
    if (cloudTotal >= 85 && precipProb < 50) {
        subjects.push({ id: 'black-white', score: 0.75 });
    }

    // 상위 5개만 반환, 점수 내림차순
    subjects.sort((a, b) => b.score - a.score);
    return subjects.slice(0, 5);
}

// ─── 분위기 태그 ──────────────────────────────────────────────
function moodTags(w, context) {
    const tags = [];
    const cloud = safeNum(w.cloudCoverTotal, 0);
    const cloudHigh = safeNum(w.cloudCoverHigh, 0);
    const cloudLow = safeNum(w.cloudCoverLow, 0);
    const hum = safeNum(w.relativeHumidity, 60);
    const precipProb = safeNum(w.precipProb, 0);
    const solar = context?.solar;

    if (cloud >= 30 && cloud <= 70 && cloudHigh > cloudLow) tags.push('dramatic-sky');
    if (cloud >= 85) tags.push('moody-overcast');
    if (cloud < 15 && solar?.phase === 'day') tags.push('harsh-sunlight');
    if (solar?.isGoldenHour) tags.push('golden-light');
    if (solar?.isBlueHour) tags.push('blue-hour');
    if (hum >= 80 && hum < 95) tags.push('atmospheric');
    if (precipProb >= 50) tags.push('rainy');
    if (precipProb < 10 && cloud < 40) tags.push('clear');
    return tags;
}

// ─── 메인 계산 ────────────────────────────────────────────────
function calculate(slot, context) {
    const w = slot.weather || slot;

    const cloudTotal = safeNum(w.cloudCoverTotal, 0);
    const cloudHigh  = safeNum(w.cloudCoverHigh, 0);
    const cloudLow   = safeNum(w.cloudCoverLow, 0);
    const wind       = safeNum(w.windSpeed, 0);
    const windGust   = safeNum(w.windGusts, wind);
    const visibility = safeNum(w.visibility, 20000);
    const humidity   = safeNum(w.relativeHumidity, 60);
    const precipProb = safeNum(w.precipProb, 0);
    const uvIndex    = safeNum(w.uvIndex, 0);

    // ─── Dramatic Sky 점수 ────────────────────────────────
    // 구름 30-70% + 고층운 우세 → 드라마틱
    const cloudCoverageOk = gaussian(cloudTotal, 50, 25); // peak 50%, 0 at 100%
    const highDominance = cloudHigh > cloudLow ? clamp((cloudHigh - cloudLow) / 50, 0, 1) : 0;
    const dramaticSky = 0.6 * cloudCoverageOk + 0.4 * highDominance;

    // ─── Flat Light 감점 ──────────────────────────────────
    // cloud > 90% → 흑백/무드용으로는 OK지만 일반 점수 감점
    const flatLightPenalty = cloudTotal > 90 ? 0.7 : 1.0;

    // ─── Rain rejection (부분) ─────────────────────────────
    const rainFactor = precipProb > 60 ? 0.3
                    :  precipProb > 40 ? 0.6
                    :  precipProb > 20 ? 0.85
                    :  1.0;

    // ─── Wind neutrality ──────────────────────────────────
    // 6m/s 이하는 무감점, 돌풍 >10 → 감점 (삼각대 흔들림)
    const windFactor = windGust > 15 ? 0.6
                    : windGust > 10 ? 0.8
                    : wind > 6 ? 0.9
                    : 1.0;

    // ─── Visibility bonus ─────────────────────────────────
    // 5km→0, 20km→1
    const visScore = clamp((visibility - 5000) / 15000, 0, 1);

    // ─── Humidity sweet spot ──────────────────────────────
    // 40-70% 최적, peak 55%
    const humidityScore = gaussian(humidity, 55, 20);

    // ─── 시간대 가산 ──────────────────────────────────────
    // 일반 사진은 낮 전체가 가능하나 골든아워 상위 보너스
    const solar = context?.solar;
    let timeFactor = 0.65; // 기본
    if (solar) {
        if (solar.isGoldenHour) timeFactor = 1.0;
        else if (solar.isBlueHour || solar.isBeltOfVenus) timeFactor = 0.85;
        else if (solar.phase === 'day') timeFactor = 0.75;
        else if (solar.phase === 'twilight') timeFactor = 0.7;
        else timeFactor = 0.35; // night (비야간 촬영은 longExposure/별 트랙)
    }

    // ─── 가중 평균 ────────────────────────────────────────
    const componentRaw = weightedAvg([
        { value: dramaticSky,  weight: 0.30 },
        { value: visScore,     weight: 0.20 },
        { value: humidityScore,weight: 0.15 },
        { value: timeFactor,   weight: 0.35 },
    ]);

    const raw = clamp(componentRaw * flatLightPenalty * rainFactor * windFactor, 0, 1);
    const score = rawToScore100(raw);
    const grade = scoreToGrade(score);

    return {
        score,
        grade,
        raw: Math.round(raw * 1000) / 1000,
        bestSubjects: matchSubjects(w, context),
        moodTags: moodTags(w, context),
        breakdown: {
            dramaticSky:  { score: dramaticSky,  label: 'Dramatic Sky' },
            visibility:   { score: visScore,     value: visibility, label: 'Visibility' },
            humidity:     { score: humidityScore,value: humidity,   label: 'Humidity' },
            timeOfDay:    { score: timeFactor,   phase: solar?.phase || null, label: 'Time of Day' },
        },
        factors: {
            flatLightPenalty,
            rainFactor,
            windFactor,
            uvIndex,
        },
    };
}

module.exports = {
    calculate,
    matchSubjects,
    moodTags,
};
