const ScoringService = {
    // === SCORING HELPERS (0 = Best, 8 = Worst) ===

    // Jet Stream Score: Based on 250hPa Wind Speed (knots)
    // Using simplified "overhead" approach since we don't have distance map yet.
    calculateJetStreamScore: (speedMs) => {
        if (speedMs == null) return 3; // Unknown = neutral-conservative (consistent with USP fallback 25kt)
        const speedKt = speedMs * 1.94384; // m/s to knots

        if (speedKt < 60) return 0;
        if (speedKt < 100) return 2;
        if (speedKt < 140) return 4;
        if (speedKt < 180) return 6;
        return 8;
    },

    // Convection Score: Based on CAPE and Time of Day
    calculateConvectionScore: (cape, hour) => {
        if (cape == null) return 2; // Unknown = mild instability (neutral, not falsely stable)

        let baseScore = 0;
        if (cape < 100) baseScore = 0;
        else if (cape < 500) baseScore = 2;
        else if (cape < 1000) baseScore = 4;
        else if (cape < 2000) baseScore = 6;
        else baseScore = 8;

        // Time factor
        let timeFactor = 1.0;
        if (hour >= 20 && hour <= 23) timeFactor = 0.7; // Stabilization
        else if (hour >= 12 && hour <= 18) timeFactor = 1.3; // Active

        return Math.min(8, Math.round(baseScore * timeFactor * 10) / 10);
    },

    // Cloud Normalization: 0-100% -> 0-8 scale (clamped)
    normalizeCloud: (percent) => {
        if (typeof percent !== 'number' || isNaN(percent)) return null;
        return Math.min(8, Math.max(0, Math.round((percent * 8) / 100)));
    },

    // Final Observation Score (0-100, Higher is Better)
    //
    // 1→2→3 Probability Model:
    //   1. Cloud check — what fraction of sky is open?
    //   2. Atmospheric quality — how good is the air? (only when sky is open)
    //   3. Final score = atmospheric_quality × cloud_probability
    //
    // Cloud is fundamentally different from other factors:
    //   seeing/jet/transparency = atmospheric QUALITY (how sharp/clear the view is)
    //   cloud = sky AVAILABILITY (probability of seeing anything at all)
    //   These are multiplicative: score = quality × availability
    //
    calculateObservationScore: (params, lang = 'en') => {
        // Atmospheric quality weights (cloud excluded, normalized to 1.0)
        // Calibrated against Meteoblue/Clear Outside/Astrospheric global standards
        // Jet stream reduced from 0.25→0.18 (250hPa wind already captured in USP seeing)
        const WEIGHTS = {
            seeing: 0.35,
            transparency: 0.20,
            wind: 0.12,
            jetstream: 0.18,
            convection: 0.15
        };

        const seeingScore = typeof params.seeing === 'number' ? params.seeing : 8;
        const transparencyScore = typeof params.transparency === 'number' ? params.transparency : 8;
        const cloudScore = typeof params.cloud === 'number' ? params.cloud : 8;
        const windScore = typeof params.wind === 'number' ? params.wind : 8;
        const jetstreamScore = typeof params.jetstream === 'number' ? params.jetstream : 8;
        const convectionScore = typeof params.convection === 'number' ? params.convection : 8;

        // Step 1: Cloud availability — fraction of sky that is open
        // cloud 0 → 100% open, cloud 4 → 50%, cloud 8 → 0%
        const cloudMultiplier = Math.max(0, (8 - cloudScore) / 8);

        // Step 2: Atmospheric quality (cloud excluded)
        const weightedBadness =
            seeingScore * WEIGHTS.seeing +
            transparencyScore * WEIGHTS.transparency +
            windScore * WEIGHTS.wind +
            jetstreamScore * WEIGHTS.jetstream +
            convectionScore * WEIGHTS.convection;

        const atmosphericQuality = (1 - weightedBadness / 8) * 100;

        // Step 3: Final = quality × cloud probability
        let finalScore = atmosphericQuality * cloudMultiplier;

        // Hard gate: cloud ≥7 → cap to 10 (sky essentially blocked)
        if (cloudScore >= 7) {
            finalScore = Math.min(finalScore, 10);
        }

        // Ensure result is a valid number and clamped
        if (isNaN(finalScore)) finalScore = 0;
        const roundedScore = Math.max(0, Math.min(100, Math.round(finalScore * 10) / 10));

        return {
            score: roundedScore,
            grade: ScoringService.getGrade(roundedScore),
            recommendation: ScoringService.getRecommendation(roundedScore, cloudScore, lang)
        };
    },

    getGrade: (score) => {
        if (score >= 85) return 'S';
        if (score >= 70) return 'A';
        if (score >= 55) return 'B';
        if (score >= 40) return 'C';
        return 'D';
    },

    getRecommendation: (score, cloudScore, lang = 'en') => {
        const isKo = lang === 'ko';
        const isJa = lang === 'ja';
        const isZh = lang === 'zh';

        // Cloud gate — sky blocked overrides score-based recommendation
        if (cloudScore >= 7) return isKo ? '관측 불가. 구름이 하늘을 완전히 가리고 있습니다.' :
            isJa ? '観測不可。空が雲に覆われています。' :
            isZh ? '无法观测。天空完全被云层遮挡。' :
            'Observation impossible. Sky fully blocked by clouds.';
        if (cloudScore >= 5) return isKo ? '구름 사이로 간헐적 관측만 가능합니다.' :
            isJa ? '雲の隙間からの断続的な観測のみ可能。' :
            isZh ? '仅能通过云隙间歇性观测。' :
            'Intermittent observation only through cloud gaps.';

        if (score >= 85) return isKo ? '안정된 하늘! 모든 대상에 최적의 관측 조건.' :
            isJa ? '安定した空！全ての対象に最高の条件。' :
            isZh ? '稳定的天空！所有目标的最佳观测条件。' :
            'Steady skies! Excellent conditions, great for all targets.';
        if (score >= 70) return isKo ? '안정적인 대기. 대부분의 관측에 적합합니다.' :
            isJa ? '安定した大気。ほとんどの観測に適しています。' :
            isZh ? '稳定的大气，适合大多数观测。' :
            'Stable air and very good conditions. Suitable for most observations.';
        if (score >= 55) return isKo ? '보통 조건. 밝은 태양계 대상 관측 가능.' :
            isJa ? '平均的な条件。明るい太陽系天体の観測に適合。' :
            isZh ? '一般条件，适合明亮的太阳系目标。' :
            'Average conditions. Stable enough for bright solar system targets.';
        if (score >= 40) return isKo ? '불량한 조건. 불안정한 대기로 일반 관측이 제한됩니다.' :
            isJa ? '不良な条件。不安定な大気で観測が制限されます。' :
            isZh ? '较差条件，不稳定的大气限制了观测。' :
            'Poor conditions. Unstable air limiting casual observation.';
        return isKo ? '대기가 너무 불안정하여 관측이 어렵습니다.' :
            isJa ? '大気が不安定すぎて観測困難。' :
            isZh ? '大气过于不稳定，难以观测。' :
            'Atmosphere is too unstable for observation.';
    }
};

module.exports = ScoringService;
