/**
 * v5.0 Photo Guide — Suggestions Rule Engine (30 rules)
 *
 * 각 슬롯에 대해 기상+천문+장르 스코어를 입력받아
 * 문맥 기반 팁을 "textKey" 단위로 반환.
 *
 * 백엔드는 textKey만 반환 → 프론트 i18n이 실제 문구 렌더.
 * 이유: payload 최소화 + 다국어 분리 유지.
 *
 * 규칙 구조:
 *   { id, topic, score, match: (w, ctx, scores) => boolean, textKey }
 *
 * 반환 시: 매칭된 규칙 중 score 상위 5개.
 */
const { safeNum } = require('./_shared');

// ─── 30개 규칙 ────────────────────────────────────────────────
const rules = [
    // ── 4-1. 광학·대비 규칙 (5) ──────────────────────────
    {
        id: 'soft-diffuse', topic: 'optics', score: 0.75,
        textKey: 'soft-diffuse',
        match: (w) => safeNum(w.cloudCoverHigh, 0) > 60 && safeNum(w.cloudCoverLow, 0) < 20,
    },
    {
        id: 'harsh-light', topic: 'optics', score: 0.6,
        textKey: 'harsh-light',
        match: (w, ctx) => safeNum(w.cloudCoverTotal, 0) < 20
            && ctx?.solar?.phase === 'day'
            && safeNum(ctx?.solar?.sunAltitude, 0) > 50,
    },
    {
        id: 'flat-light', topic: 'optics', score: 0.55,
        textKey: 'flat-light-bw',
        match: (w) => safeNum(w.cloudCoverTotal, 0) > 90,
    },
    {
        id: 'rim-light', topic: 'optics', score: 0.7,
        textKey: 'rim-light',
        match: (w, ctx) => safeNum(w.cloudCoverTotal, 0) < 50
            && (ctx?.solar?.isGoldenHour || safeNum(ctx?.solar?.sunAltitude, 90) < 20)
            && w.isDay !== 0,
    },
    {
        id: 'chiaroscuro', topic: 'optics', score: 0.75,
        textKey: 'chiaroscuro',
        match: (w) => {
            const mid = safeNum(w.cloudCoverMid, 0);
            return mid >= 40 && mid <= 70 && safeNum(w.cloudCoverLow, 0) < 40;
        },
    },

    // ── 4-2. 색·색온도 규칙 (5) ──────────────────────────
    {
        id: 'burning-sky', topic: 'color', score: 1.0,
        textKey: 'burning-sky',
        match: (w, ctx, scores) => (scores?.skyColor?.raw ?? 0) > 0.75
            && scores?.skyColor?.isActiveTime,
    },
    {
        id: 'vivid-golden', topic: 'color', score: 0.9,
        textKey: 'vivid-golden',
        match: (w, ctx, scores) => {
            const r = scores?.skyColor?.raw ?? 0;
            return r >= 0.55 && r < 0.75 && scores?.skyColor?.isActiveTime;
        },
    },
    {
        id: 'pastel-pink', topic: 'color', score: 0.7,
        textKey: 'pastel-pink',
        match: (w, ctx, scores) => {
            const r = scores?.skyColor?.raw ?? 0;
            return r >= 0.35 && r < 0.55 && scores?.skyColor?.isActiveTime;
        },
    },
    {
        id: 'blue-hour-deep', topic: 'color', score: 0.85,
        textKey: 'blue-hour-deep',
        match: (w, ctx) => ctx?.solar?.isBlueHour,
    },
    {
        id: 'magic-hour-magenta', topic: 'color', score: 0.8,
        textKey: 'magic-hour-magenta',
        match: (w, ctx) => ctx?.solar?.isGoldenHour
            && safeNum(w.cloudCoverHigh, 0) >= 40 && safeNum(w.cloudCoverHigh, 0) <= 60,
    },

    // ── 4-3. 움직임·시간 규칙 (5) ────────────────────────
    {
        id: 'calm-reflection', topic: 'motion', score: 0.75,
        textKey: 'calm-reflection',
        match: (w) => safeNum(w.windSpeed, 5) < 2 && safeNum(w.relativeHumidity, 0) > 70,
    },
    {
        id: 'cloud-trail-ready', topic: 'motion', score: 0.7,
        textKey: 'cloud-trail-ready',
        match: (w) => {
            const wind = safeNum(w.windSpeed, 0);
            const mid = safeNum(w.cloudCoverMid, 0);
            const high = safeNum(w.cloudCoverHigh, 0);
            return wind >= 2 && wind <= 5 && (mid + high >= 40 && mid + high <= 140);
        },
    },
    {
        id: 'water-silk-opportunity', topic: 'motion', score: 0.65,
        textKey: 'water-silk-opportunity',
        match: (w) => safeNum(w.cloudCoverTotal, 0) > 50 && safeNum(w.windSpeed, 0) < 4,
    },
    {
        id: 'wind-warning', topic: 'safety', score: 0.8,
        textKey: 'wind-warning',
        match: (w) => safeNum(w.windGusts, 0) > 10,
    },
    {
        id: 'star-trail-ready', topic: 'motion', score: 0.85,
        textKey: 'star-trail-ready',
        match: (w, ctx) => w.isDay === 0
            && safeNum(ctx?.astro?.moonFraction, 1) < 0.3
            && safeNum(w.cloudCoverTotal, 100) < 20,
    },

    // ── 4-4. 주제·피사체 제안 규칙 (5) ───────────────────
    {
        id: 'fog-morning-gold', topic: 'subject', score: 0.95,
        textKey: 'fog-morning-gold',
        match: (w, ctx, scores) => (scores?.fogSubject?.raw ?? 0) > 0.6
            && ctx?.solar?.phase === 'goldenHourDawn',
    },
    {
        id: 'after-rain-clarity', topic: 'subject', score: 0.7,
        textKey: 'after-rain-clarity',
        match: (w, ctx) => {
            const prev = ctx?.prevSlot;
            return prev && safeNum(prev.weather?.precipProb, 0) > 50
                && safeNum(w.precipProb, 0) < 20;
        },
    },
    {
        id: 'rainbow-chance', topic: 'subject', score: 0.85,
        textKey: 'rainbow-chance',
        match: (w, ctx) => {
            const pp = safeNum(w.precipProb, 0);
            const sun = ctx?.solar;
            return pp >= 20 && pp <= 50
                && w.isDay !== 0
                && sun && safeNum(sun.sunAltitude, 99) > 0 && safeNum(sun.sunAltitude, 99) < 42;
        },
    },
    {
        id: 'low-fog-valley', topic: 'subject', score: 0.85,
        textKey: 'low-fog-valley',
        match: (w, ctx) => safeNum(w.dewPointSpread, 99) < 1.5
            && safeNum(w.windSpeed, 99) < 3
            && (ctx?.elevation ?? 9999) < 400,
    },
    {
        id: 'sea-fog-coast', topic: 'subject', score: 0.85,
        textKey: 'sea-fog-coast',
        match: (w, ctx) => ctx?.isCoastal
            && safeNum(w.relativeHumidity, 0) > 90
            && safeNum(w.windSpeed, 99) < 5,
    },

    // ── 4-5. 자연현상 트리거 규칙 (5) ─────────────────────
    {
        id: 'tonight-blood-moon', topic: 'phenomena', score: 1.0,
        textKey: 'tonight-blood-moon',
        match: (w, ctx, scores) => (scores?.phenomena?.linkedPhenomena || [])
            .some(p => p.type === 'blood-moon' && p.visible),
    },
    {
        id: 'perseid-peak', topic: 'phenomena', score: 0.9,
        textKey: 'meteor-shower-peak',
        match: (w, ctx, scores) => (scores?.phenomena?.linkedPhenomena || [])
            .some(p => p.type === 'meteor-shower' && (p.moonFraction ?? 1) < 0.3),
    },
    {
        id: 'halo-22-possible', topic: 'phenomena', score: 0.7,
        textKey: 'halo-22-possible',
        match: (w, ctx, scores) => (scores?.phenomena?.opticalEvents || [])
            .some(e => e.id === 'halo-22'),
    },
    {
        id: 'sun-pillar-possible', topic: 'phenomena', score: 0.75,
        textKey: 'sun-pillar-possible',
        match: (w, ctx, scores) => (scores?.phenomena?.opticalEvents || [])
            .some(e => e.id === 'sun-pillar'),
    },
    {
        id: 'belt-of-venus-window', topic: 'phenomena', score: 0.7,
        textKey: 'belt-of-venus-window',
        match: (w, ctx) => ctx?.solar?.isBeltOfVenus === true,
    },

    // ── 4-6. 안전·보조 규칙 (5) ───────────────────────────
    {
        id: 'uv-warning', topic: 'safety', score: 0.5,
        textKey: 'uv-warning',
        match: (w) => safeNum(w.uvIndex, 0) > 7,
    },
    {
        id: 'condensation-risk', topic: 'safety', score: 0.6,
        textKey: 'condensation-risk',
        match: (w) => safeNum(w.dewPointSpread, 99) < 2
            && safeNum(w.relativeHumidity, 0) > 85,
    },
    {
        id: 'golden-hour-countdown', topic: 'info', score: 0.65,
        textKey: 'golden-hour-countdown',
        match: (w, ctx) => {
            const solar = ctx?.solar;
            const twilightDay = ctx?.twilightDay;
            if (!twilightDay?.dusk?.goldenHour?.start) return false;
            if (solar?.isGoldenHour) return false;
            const t = new Date(ctx?.slotTime || 0).getTime();
            const g = new Date(twilightDay.dusk.goldenHour.start).getTime();
            if (isNaN(t) || isNaN(g)) return false;
            const mins = (g - t) / 60000;
            return mins > 0 && mins <= 45;
        },
    },
    {
        id: 'battery-cold', topic: 'safety', score: 0.45,
        textKey: 'battery-cold',
        match: (w) => safeNum(w.temp2m, 99) < -5,
    },
    {
        id: 'sensor-dust-risk', topic: 'safety', score: 0.55,
        textKey: 'sensor-dust-risk',
        match: (w, ctx) => safeNum(w.windGusts, 0) > 15 && ctx?.isCoastal,
    },
];

/**
 * 슬롯에 대해 매칭되는 상위 N개 규칙을 반환.
 *
 * @param {object} slot       - { time, weather: { ... } }
 * @param {object} context    - { solar, twilightDay, astro, elevation, isCoastal, isUrban, lat, lon, prevSlot, slotTime }
 * @param {object} scores     - 다른 카테고리 결과 (e.g., { skyColor, fogSubject, phenomena })
 * @param {number} limit      - default 5
 * @returns {Array<{id, topic, textKey, score}>}
 */
function generateSuggestions(slot, context, scores = {}, limit = 5) {
    const w = slot.weather || slot;
    const ctxWithTime = { ...context, slotTime: slot.time };

    const matched = [];
    for (const r of rules) {
        try {
            if (r.match(w, ctxWithTime, scores)) {
                matched.push({
                    id:      r.id,
                    topic:   r.topic,
                    textKey: r.textKey,
                    score:   r.score,
                });
            }
        } catch (e) {
            // rule failure — skip
        }
    }

    matched.sort((a, b) => b.score - a.score);
    return matched.slice(0, limit);
}

module.exports = {
    rules,
    generateSuggestions,
};
