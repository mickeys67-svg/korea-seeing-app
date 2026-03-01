import type { ForecastItem } from '../types/weather';

export type TargetId = 'planet' | 'milkyway' | 'nebula' | 'cluster' | 'galaxy';
export type TargetGrade = 'S' | 'A' | 'B' | 'C' | 'F';
export type LimitingFactor =
    | 'seeing' | 'transparency' | 'cloudCover'
    | 'wind' | 'jetStream' | 'convection' | 'moon';

export interface TargetResult {
    id: TargetId;
    emoji: string;
    score: number;          // 0-100
    grade: TargetGrade;
    limitingFactor: LimitingFactor;
}

interface TargetModel {
    id: TargetId;
    emoji: string;
    /** 0 = moon ignored, 0-1 = linear penalty, ≥1 = exponential gating */
    moonSensitivity: number;
    /** Weights for each atmospheric factor — must sum to 1.0 */
    weights: Record<string, number>;
    /** Exponential decay constant k for each factor: quality = exp(-val * k) */
    sensitivity: Record<string, number>;
}

/**
 * Five physics-calibrated target models.
 *
 * Factor input scale: 0 (perfect) → 8 (worst)
 * Output quality:     1.0 (perfect) → ~0 (terrible) via exp(-val * k)
 *
 * Calibration reference:
 *   k=0.40 → score=3 gives quality 0.30 (good seeing threshold)
 *   k=0.55 → score=3 gives quality 0.19 (cloud hurts fast)
 *   k=0.55 → score=0 gives quality 1.00 (clear sky = perfect)
 */
const TARGETS: TargetModel[] = [
    {
        // Planets need rock-steady seeing above all else. Moon barely matters
        // (Jupiter is easily visible even under full moon).
        id: 'planet',
        emoji: '🪐',
        moonSensitivity: 0.0,
        weights:     { seeing: 0.45, transparency: 0.05, cloudCover: 0.25, wind: 0.15, jetStream: 0.10, convection: 0.00 },
        sensitivity: { seeing: 0.40, transparency: 0.15, cloudCover: 0.55, wind: 0.25, jetStream: 0.30, convection: 0.20 },
    },
    {
        // Milky Way needs maximum darkness — even a crescent moon degrades contrast.
        // Seeing is almost irrelevant (naked eye / ultra-wide lens).
        id: 'milkyway',
        emoji: '🌌',
        moonSensitivity: 1.5,
        weights:     { seeing: 0.08, transparency: 0.30, cloudCover: 0.35, wind: 0.10, jetStream: 0.10, convection: 0.07 },
        sensitivity: { seeing: 0.15, transparency: 0.50, cloudCover: 0.55, wind: 0.20, jetStream: 0.20, convection: 0.15 },
    },
    {
        // Nebulae need dark skies + excellent transparency. Moderate seeing acceptable.
        // Moon washes out faint emission nebulae significantly.
        id: 'nebula',
        emoji: '💫',
        moonSensitivity: 0.7,
        weights:     { seeing: 0.15, transparency: 0.30, cloudCover: 0.35, wind: 0.10, jetStream: 0.07, convection: 0.03 },
        sensitivity: { seeing: 0.30, transparency: 0.50, cloudCover: 0.55, wind: 0.20, jetStream: 0.25, convection: 0.20 },
    },
    {
        // Star clusters are bright and tolerant — half-moon is fine, good seeing helps
        // but isn't critical. Cloud cover is the primary enemy.
        id: 'cluster',
        emoji: '✨',
        moonSensitivity: 0.3,
        weights:     { seeing: 0.22, transparency: 0.18, cloudCover: 0.38, wind: 0.12, jetStream: 0.08, convection: 0.02 },
        sensitivity: { seeing: 0.30, transparency: 0.35, cloudCover: 0.55, wind: 0.25, jetStream: 0.20, convection: 0.20 },
    },
    {
        // Galaxies need the darkest skies and excellent transparency.
        // Surface brightness is very low — moon and light pollution are critical.
        id: 'galaxy',
        emoji: '🔭',
        moonSensitivity: 1.0,
        weights:     { seeing: 0.18, transparency: 0.32, cloudCover: 0.30, wind: 0.10, jetStream: 0.08, convection: 0.02 },
        sensitivity: { seeing: 0.35, transparency: 0.55, cloudCover: 0.55, wind: 0.20, jetStream: 0.25, convection: 0.20 },
    },
];

function getGrade(score: number): TargetGrade {
    if (score >= 85) return 'S';
    if (score >= 70) return 'A';
    if (score >= 55) return 'B';
    if (score >= 40) return 'C';
    return 'F';
}

/**
 * Compute a moon quality multiplier (0-1).
 *
 * moonSensitivity = 0       → multiplier always 1.0 (moon ignored)
 * moonSensitivity 0 < s < 1 → linear penalty: 1 - fraction * s
 * moonSensitivity ≥ 1       → exponential gating: (1 - fraction)^(s * 2)
 *
 * Examples with full moon (fraction = 1.0):
 *   cluster  (s=0.3): 1 - 1.0*0.3 = 0.70  (30% reduction)
 *   nebula   (s=0.7): 1 - 1.0*0.7 = 0.30  (70% reduction)
 *   galaxy   (s=1.0): 0.001^2     ≈ 0.000  (nearly blocked)
 *   milkyway (s=1.5): 0.001^3     ≈ 0.000  (completely blocked)
 */
function getMoonMultiplier(moonFraction: number, sensitivity: number): number {
    if (sensitivity <= 0) return 1.0;
    if (sensitivity >= 1.0) {
        return Math.pow(Math.max(0.001, 1 - moonFraction), sensitivity * 2);
    }
    return Math.max(0, 1 - moonFraction * sensitivity);
}

/**
 * Predict suitability scores for all 5 target types.
 *
 * @param forecast  Current forecast time-block (from ForecastItem)
 * @param moonFraction  0 = new moon (best), 1 = full moon (worst)
 */
export function predictTargets(forecast: ForecastItem, moonFraction: number): TargetResult[] {
    const { scores } = forecast;

    return TARGETS.map(model => {
        // ── Step 1: Exponential quality for each atmospheric factor ──────────
        // quality(val) = exp(-val * k)  →  1.0 (perfect) … ~0 (terrible)
        const qualityMap: Record<string, number> = {};
        for (const [key, k] of Object.entries(model.sensitivity)) {
            const val = (scores as Record<string, number>)[key] ?? 0;
            qualityMap[key] = Math.exp(-val * k);
        }

        // ── Step 2: Weighted atmospheric score (0-1) ─────────────────────────
        let atmosphericScore = 0;
        for (const [key, weight] of Object.entries(model.weights)) {
            atmosphericScore += weight * (qualityMap[key] ?? 1);
        }

        // ── Step 3: Moon multiplier ───────────────────────────────────────────
        const moonMult = getMoonMultiplier(moonFraction, model.moonSensitivity);

        // ── Step 4: Final score ───────────────────────────────────────────────
        const score = Math.min(100, Math.max(0, Math.round(atmosphericScore * moonMult * 100)));

        // ── Step 5: Find primary limiting factor ─────────────────────────────
        // Metric: (1 - quality) * weight  →  how much each factor is dragging the score down
        let limitingFactor: LimitingFactor = 'cloudCover';
        let maxDrop = 0;

        for (const [key, weight] of Object.entries(model.weights)) {
            if (weight <= 0) continue;
            const q = qualityMap[key] ?? 1;
            const drop = (1 - q) * weight;
            if (drop > maxDrop) {
                maxDrop = drop;
                limitingFactor = key as LimitingFactor;
            }
        }

        // Check if moon is more limiting than any atmospheric factor
        if (model.moonSensitivity > 0) {
            const moonDrop = (1 - moonMult) * model.moonSensitivity * 0.5;
            if (moonDrop > maxDrop) {
                limitingFactor = 'moon';
            }
        }

        return {
            id: model.id,
            emoji: model.emoji,
            score,
            grade: getGrade(score),
            limitingFactor,
        };
    });
}
