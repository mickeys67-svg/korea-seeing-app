const ScoringService = {
    // === SCORING HELPERS (0 = Best, 8 = Worst) ===

    // Jet Stream Score: Based on 250hPa Wind Speed (knots)
    // Using simplified "overhead" approach since we don't have distance map yet.
    calculateJetStreamScore: (speedMs) => {
        if (speedMs == null) return 8; // Unknown = assume worst for safety.
        const speedKt = speedMs * 1.94384; // m/s to knots

        if (speedKt < 50) return 0;
        if (speedKt < 80) return 2;
        if (speedKt < 120) return 4;
        if (speedKt < 150) return 6;
        return 8;
    },

    // Convection Score: Based on CAPE and Time of Day
    calculateConvectionScore: (cape, hour) => {
        if (cape == null) return 0; // Assume stable if no data

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

    // Cloud Normalization: 0-100% -> 0-8 scale
    normalizeCloud: (percent) => {
        if (typeof percent !== 'number') return null;
        return Math.round((percent * 8) / 100);
    },

    // Final Observation Score (0-100, Higher is Better)
    calculateObservationScore: (params) => {
        const WEIGHTS = {
            seeing: 0.25,
            transparency: 0.15,
            cloud: 0.20,
            wind: 0.10,
            jetstream: 0.20,
            convection: 0.10
        };

        // Extract individual scores from params, ensuring they are numbers
        // and defaulting to 8 (worst) if missing or invalid, as per the original logic's spirit
        // for components that contribute negatively to the score.
        // For cloud, if null, it's often treated as 0 (best) in other contexts, but here we'll default to 8 for safety.
        const seeingScore = typeof params.seeing === 'number' ? params.seeing : 8;
        const transparencyScore = typeof params.transparency === 'number' ? params.transparency : 8;
        const cloudScore = typeof params.cloud === 'number' ? params.cloud : 8;
        const windScore = typeof params.wind === 'number' ? params.wind : 8;
        const jetstreamScore = typeof params.jetstream === 'number' ? params.jetstream : 8;
        const convectionScore = typeof params.convection === 'number' ? params.convection : 8;

        // Final score calculation with safety clamping
        const weightedSum = (seeingScore * 8) + (transparencyScore * 5) + (cloudScore * 10) +
            (windScore * 3) + (jetstreamScore * 2) + (convectionScore * 2);

        // Max theoretical weighted sum: (8*8 + 8*5 + 8*10 + 8*3 + 8*2 + 8*2) = 64+40+80+24+16+16 = 240
        // Normalized to 0-100
        let finalScore = (weightedSum / 240) * 100;

        // Ensure result is a valid number and clamped
        if (isNaN(finalScore)) finalScore = 0; // Default to 0 if NaN
        finalScore = Math.max(0, Math.min(100, Math.round(finalScore))); // Clamp to 0-100 and round to nearest integer

        // The original code had a `roundedScore` that rounded to one decimal place.
        // Let's re-introduce that after the clamping and integer rounding.
        const roundedScore = Math.round(finalScore * 10) / 10;

        return {
            score: roundedScore,
            grade: ScoringService.getGrade(roundedScore),
            recommendation: ScoringService.getRecommendation(roundedScore)
        };
    },

    getGrade: (score) => {
        if (score >= 85) return 'S';
        if (score >= 70) return 'A';
        if (score >= 55) return 'B';
        if (score >= 40) return 'C';
        return 'D';
    },

    getRecommendation: (score) => {
        if (score >= 85) return 'Steady skies! Excellent conditions, great for all targets.';
        if (score >= 70) return 'Stable air and very good conditions. Suitable for most observations.';
        if (score >= 55) return 'Average conditions. Stable enough for bright solar system targets.';
        if (score >= 40) return 'Poor conditions. Unstable air limiting casual observation.';
        return 'Atmosphere is too unstable for observation.';
    }
};

module.exports = ScoringService;
