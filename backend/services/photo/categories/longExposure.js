/**
 * v5.0 Photo Guide — Long Exposure Scorer
 *
 * 수평 시간을 흐름으로. 구름·물·빛의 "움직임"이 피사체.
 *
 * 핵심 공식:
 *   - Wind strict: <3m/s 최적, <5m/s 허용, >5m/s 감점 (삼각대 진동)
 *   - Cloud motion: cloudMid/High × wind250hPa → 구름 트레일 품질
 *   - Water silk: 구름 + 저광 → ND 필터 장노출
 *   - Light trails: is_day=0 + 도시 좌표 → 야간 차량
 *   - Star trails: moon.fraction < 0.3 + cloudCover < 30% → 별궤적
 *
 * Output: score, grade, bestSubjects[], recommendedShutter
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

// ─── 권장 셔터 계산 (초 단위) ─────────────────────────────────
function recommendShutterSpeed(subject, wind, cloudCover) {
    switch (subject) {
        case 'cloud-trail':
            // 바람 강할수록 짧게. cloud 많을수록 길게.
            if (wind > 8) return { min: 15, max: 30, unit: 's' };
            if (wind > 4) return { min: 30, max: 90, unit: 's' };
            return { min: 60, max: 180, unit: 's' };
        case 'water-silk':
            return { min: 2, max: 8, unit: 's' };
        case 'ocean-long-exp':
            return { min: 30, max: 120, unit: 's' };
        case 'light-trail':
            return { min: 10, max: 30, unit: 's' };
        case 'star-trail':
            return { min: 900, max: 7200, unit: 's' }; // 15min~2h
        default:
            return null;
    }
}

// ─── 서브장르 점수 ────────────────────────────────────────────
function scoreSubjects(w, context) {
    const subjects = [];
    const wind       = safeNum(w.windSpeed, 0);
    const windGust   = safeNum(w.windGusts, wind);
    const cloudHigh  = safeNum(w.cloudCoverHigh, 0);
    const cloudMid   = safeNum(w.cloudCoverMid, 0);
    const cloudLow   = safeNum(w.cloudCoverLow, 0);
    const cloudTotal = safeNum(w.cloudCoverTotal, cloudHigh + cloudMid + cloudLow);
    const humidity   = safeNum(w.relativeHumidity, 60);
    const precipProb = safeNum(w.precipProb, 0);
    const isDay      = w.isDay !== 0;
    const jetKts     = safeNum(w.jetStreamSpeed, 0);
    const moonFrac   = safeNum(context?.astro?.moonFraction, 0.5);
    const solar      = context?.solar;

    // ─ Cloud Trail ─
    // 중·고층운 있고 바람 약한 편 (제트는 상층 이동 속도로 작용)
    const cloudMotion = clamp((cloudMid + cloudHigh) / 120, 0, 1);
    const upperWindOk = jetKts > 20 && jetKts < 120; // 적당히 빠른 상층풍
    const groundWindOk = wind < 5 ? 1 : wind < 8 ? 0.5 : 0;
    const cloudTrailScore = clamp(
        0.5 * cloudMotion + 0.3 * (upperWindOk ? 1 : 0.4) + 0.2 * groundWindOk,
        0, 1
    );
    if (cloudTrailScore > 0.35 && precipProb < 50) {
        subjects.push({
            id: 'cloud-trail',
            score: cloudTrailScore,
            shutter: recommendShutterSpeed('cloud-trail', wind, cloudTotal),
        });
    }

    // ─ Water Silk (waterfall/stream) ─
    // 낮·약한 직사광 조건. 구름 있을수록 자연 ND.
    const waterSilkScore = clamp(
        0.4 * gaussian(cloudTotal, 60, 30) +
        0.3 * (wind < 3 ? 1 : wind < 6 ? 0.6 : 0.2) +
        0.3 * (isDay ? 1 : 0),
        0, 1
    );
    if (waterSilkScore > 0.4) {
        subjects.push({
            id: 'water-silk',
            score: waterSilkScore,
            shutter: recommendShutterSpeed('water-silk', wind, cloudTotal),
        });
    }

    // ─ Ocean Long Exposure ─
    // 해안·강한 파도 + 저광 + 약한 바람이 이상적
    const oceanScore = clamp(
        0.4 * (wind < 4 ? 1 : wind < 8 ? 0.6 : 0.3) +
        0.3 * gaussian(cloudTotal, 55, 30) +
        0.3 * (solar?.isGoldenHour || solar?.isBlueHour ? 1 : 0.5),
        0, 1
    );
    if (oceanScore > 0.45 && context?.isCoastal) {
        subjects.push({
            id: 'ocean-long-exp',
            score: oceanScore,
            shutter: recommendShutterSpeed('ocean-long-exp', wind, cloudTotal),
        });
    }

    // ─ Light Trail ─
    // 야간 + 구름 적당 + 도시
    if (!isDay) {
        const lightTrailScore = clamp(
            0.5 * (context?.isUrban ? 1 : 0.3) +
            0.3 * invLinRamp(cloudTotal, 30, 90) +
            0.2 * (wind < 6 ? 1 : 0.5),
            0, 1
        );
        if (lightTrailScore > 0.35) {
            subjects.push({
                id: 'light-trail',
                score: lightTrailScore,
                shutter: recommendShutterSpeed('light-trail', wind, cloudTotal),
            });
        }
    }

    // ─ Star Trail ─
    // 야간 + 맑음 + 달 간섭 낮음 + 바람 약함
    if (!isDay && solar?.phase === 'night') {
        const starTrailScore = clamp(
            0.4 * invLinRamp(cloudTotal, 10, 40) +
            0.3 * invLinRamp(moonFrac, 0.2, 0.6) +
            0.2 * (wind < 4 ? 1 : 0.4) +
            0.1 * invLinRamp(precipProb, 0, 20),
            0, 1
        );
        if (starTrailScore > 0.4) {
            subjects.push({
                id: 'star-trail',
                score: starTrailScore,
                shutter: recommendShutterSpeed('star-trail', wind, cloudTotal),
            });
        }
    }

    subjects.sort((a, b) => b.score - a.score);
    return subjects.slice(0, 5);
}

// ─── 메인 계산 ────────────────────────────────────────────────
function calculate(slot, context) {
    const w = slot.weather || slot;

    const wind       = safeNum(w.windSpeed, 0);
    const windGust   = safeNum(w.windGusts, wind);
    const cloudTotal = safeNum(w.cloudCoverTotal, 0);
    const precipProb = safeNum(w.precipProb, 0);

    // ─── Wind (gust) strict ──────────────────────────────
    // 장노출의 제1 적은 삼각대 흔들림
    const windStability =
        windGust < 2 ? 1.0 :
        windGust < 4 ? 0.85 :
        windGust < 6 ? 0.65 :
        windGust < 8 ? 0.40 :
        windGust < 12 ? 0.20 :
        0.05;

    // ─── 서브장르 최고점 ─────────────────────────────────
    const subjects = scoreSubjects(w, context);
    const topSubjectScore = subjects.length > 0 ? subjects[0].score : 0.2;

    // ─── Rain rejection ──────────────────────────────────
    const rainFactor = precipProb > 70 ? 0.2
                    : precipProb > 40 ? 0.6
                    : 1.0;

    const raw = clamp(
        weightedAvg([
            { value: windStability, weight: 0.35 },
            { value: topSubjectScore, weight: 0.55 },
            { value: rainFactor,    weight: 0.10 },
        ]),
        0, 1
    );

    const score = rawToScore100(raw);
    const grade = scoreToGrade(score);

    return {
        score,
        grade,
        raw: Math.round(raw * 1000) / 1000,
        bestSubjects: subjects,
        breakdown: {
            windStability: { score: windStability, value: windGust, label: 'Wind Stability' },
            topSubject:    { score: topSubjectScore, id: subjects[0]?.id || null, label: 'Best Subject' },
            rainFactor:    { score: rainFactor, value: precipProb, label: 'Rain Factor' },
        },
        factors: {
            wind, windGust, cloudTotal, precipProb,
        },
    };
}

module.exports = {
    calculate,
    scoreSubjects,
    recommendShutterSpeed,
};
