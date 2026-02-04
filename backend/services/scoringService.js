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

        const weightedSum =
            params.seeing * WEIGHTS.seeing +
            params.transparency * WEIGHTS.transparency +
            params.cloud * WEIGHTS.cloud +
            params.wind * WEIGHTS.wind +
            params.jetstream * WEIGHTS.jetstream +
            params.convection * WEIGHTS.convection;

        // Inverse calculation: 8 (Worst) -> 0, 0 (Best) -> 100
        const finalScore = 100 - ((weightedSum / 8.0) * 100);
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
        if (score >= 85) return 'Excellent conditions! Great for all targets.';
        if (score >= 70) return 'Very good conditions. Suitable for most observations.';
        if (score >= 55) return 'Average conditions. Good for bright targets.';
        if (score >= 40) return 'Poor conditions. Limited to casual observation.';
        return 'Unsuitable for observation.';
    }
};

module.exports = ScoringService;
