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
    /**
     * How sensitive this target is to moonlight.
     *   0        = immune (planets — visible even under full moon)
     *   0 < s < 1 = linear penalty: moonMult = 1 - fraction * s
     *   s ≥ 1    = exponential gate:  moonMult = (1 - fraction)^(s * 2)
     */
    moonSensitivity: number;
    /** Factor weights — each row MUST sum to 1.0 */
    weights: Record<string, number>;
    /**
     * Exponential decay constant k per factor: quality = exp(-val * k)
     * Factor input: 0 (perfect) → 8 (worst)
     * Factor output: 1.0 (perfect) → ~0 (terrible)
     *
     * Calibration reference:
     *   k=0.40, val=1 → 0.67   k=0.40, val=4 → 0.20
     *   k=0.55, val=1 → 0.58   k=0.55, val=4 → 0.11  (cloud punished hard)
     *   k=0.35, val=3 → 0.35   k=0.50, val=3 → 0.22
     */
    sensitivity: Record<string, number>;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 *  Five physics-calibrated target models.
 *
 *  Data source scales (from backend scoringService.js):
 *   • seeing / transparency: 0-8 continuous (0 = perfect)
 *   • cloudCover: 0-8 linear (0 % → 0, 100 % → 8)
 *   • wind: 0-8 based on surface wind speed
 *   • jetStream: DISCRETE {0,2,4,6,8} based on 250 hPa wind speed
 *       0 = <50 kt (<25.7 m/s)   excellent planetary seeing
 *       2 = 50-80 kt             borderline for high magnification
 *       4 = 80-120 kt            poor planetary, routine for DSO
 *       6 = 120-150 kt           very poor
 *       8 = >150 kt              extreme (rare)
 *   • convection: DISCRETE {0,2,4,6,8} from CAPE (J/kg) + time factor
 *       0 = CAPE <100            excellent stability
 *       2 = 100-500 J/kg         mild (×0.7 at night → often stays low)
 *       4 = 500-1000 J/kg        moderate evening convection
 *       6 = 1000-2000 J/kg       strong (thunderstorm risk)
 *       8 = >2000 J/kg           severe
 *
 *  Calibrated against:
 *   • Sky & Telescope observing conditions and planetary imaging guides
 *   • Astronomical League / IDA dark-sky standards (Bortle scale)
 *   • Cloudy Nights forum (planetary imaging expert consensus)
 *   • Damian Peach / Christopher Go planetary jet-stream sensitivity studies
 *   • IDA Milky Way photography and dark-sky measurement standards
 *   • Optolong, IDAS, Antlia narrowband filter specs (nebula moon tolerance)
 * ─────────────────────────────────────────────────────────────────────
 */
const TARGETS: TargetModel[] = [
    {
        // ── 🪐 PLANETS ──────────────────────────────────────────────────
        // Primary need: atmospheric stability (seeing + jet stream).
        // Transparency irrelevant (planets are bright point-like sources).
        // Moon: visible even under full moon, but scattered moonlight lowers
        // contrast in the eyepiece → small non-zero penalty (10% @ full moon).
        // Convection: daytime CAPE causes evening "atmospheric boil" — must not be zero.
        // Jet stream at 250 hPa is as important as local seeing for planetary resolution
        // (expert imagers: "the best planetary nights = jet stream south of your location").
        id: 'planet',
        emoji: '🪐',
        moonSensitivity: 0.10,  // full moon → 10% reduction only
        weights:     { seeing: 0.40, transparency: 0.05, cloudCover: 0.25, wind: 0.10, jetStream: 0.15, convection: 0.05 },
        sensitivity: { seeing: 0.40, transparency: 0.15, cloudCover: 0.55, wind: 0.25, jetStream: 0.35, convection: 0.25 },
        //            ─────────────────────────────────────────────────────────────────
        //            sum = 0.40+0.05+0.25+0.10+0.15+0.05 = 1.00 ✓
        //
        //  Changes from v1:
        //   jetStream  0.10→0.15  (critical for planetary resolution, as important as local seeing)
        //   wind       0.15→0.10  (ground wind less critical than upper atmosphere)
        //   convection 0.00→0.05  (daytime heating → evening atmospheric boil)
        //   seeing     0.45→0.40  (room for jetStream/convection)
        //   moonSens   0.00→0.10  (non-zero: scattered light reduces contrast)
        //   jetStream sens 0.30→0.35 (faster quality decay for strong jet)
    },
    {
        // ── 🌌 MILKY WAY ─────────────────────────────────────────────────
        // Wide-field photography (14-35mm lens, f/1.4-f/2.8, 10-30s exposures).
        // Moon = death sentence even at 10-15% illumination (MW contrast washed out).
        // Transparency/darkness is THE critical factor (IDA Bortle scale).
        // Seeing is almost irrelevant — you're not resolving individual stars.
        // Wind: at typical focal lengths ground vibration negligible; weight ~0.05.
        // Jet stream: completely irrelevant for wide-angle imaging.
        // Convection: matters indirectly via haze/moisture trapping → modest weight.
        id: 'milkyway',
        emoji: '🌌',
        moonSensitivity: 1.5,   // full moon → score ≈ 0 (completely blocked)
        weights:     { seeing: 0.08, transparency: 0.37, cloudCover: 0.38, wind: 0.05, jetStream: 0.04, convection: 0.08 },
        sensitivity: { seeing: 0.15, transparency: 0.50, cloudCover: 0.55, wind: 0.20, jetStream: 0.10, convection: 0.15 },
        //            sum = 0.08+0.37+0.38+0.05+0.04+0.08 = 1.00 ✓
        //
        //  Changes from v1:
        //   transparency  0.30→0.37  (sky darkness proxy — primary factor)
        //   wind          0.10→0.05  (wide-angle lens, ground vibration negligible)
        //   jetStream     0.10→0.04  (completely irrelevant for wide-field)
        //   convection    0.07→0.08  (haze/humidity trapping effect)
        //   jetStream sens 0.20→0.10 (slower decay since weight is tiny)
    },
    {
        // ── 💫 NEBULAE ───────────────────────────────────────────────────
        // Emission / reflection / planetary nebulae mix.
        // Typical imaging: 500-1500mm focal length, moderate exposure stacking (5-20 min/frame).
        // Seeing: matters at these focal lengths — fine nebula filaments (e.g., Veil, Crab)
        //   require steady air to resolve at 1000mm+ FL.
        // Transparency: critical for reflection nebulae and faint emission wings.
        //
        // Jet stream: HIGHER weight than wide-field targets.
        //   At 500-1500mm, jet stream turbulence at 250 hPa (< 80 kt = score 2) can
        //   cause measurable blur during 10-min sub-exposures. This is fundamentally
        //   different from Milky Way imaging at 24mm where jet stream is irrelevant.
        //
        // Moon sensitivity calibrated for ~70% broadband / 30% dual-narrowband users:
        //   Broadband (DSLR/color OSC): moonSens ≈ 0.85  (full moon → 15% quality)
        //   Dual-narrowband (Optolong L-eNhance, IDAS NBZT, Antlia ALP-T): moonSens ≈ 0.10
        //   Weighted average: 0.70×0.85 + 0.30×0.15 = 0.64 → rounded to 0.70
        //   (Narrowband passes only Hα+OIII/SII; moonlight is ~continuum → mostly blocked)
        id: 'nebula',
        emoji: '💫',
        moonSensitivity: 0.70,  // full moon → 30% remaining; half moon → 65%
        weights:     { seeing: 0.20, transparency: 0.32, cloudCover: 0.28, wind: 0.08, jetStream: 0.09, convection: 0.03 },
        sensitivity: { seeing: 0.30, transparency: 0.50, cloudCover: 0.55, wind: 0.20, jetStream: 0.25, convection: 0.20 },
        //            sum = 0.20+0.32+0.28+0.08+0.09+0.03 = 1.00 ✓
        //
        //  Changes from v2:
        //   moonSens      0.75→0.70  (narrowband filter adoption; 30% users can image in moonlight)
        //   jetStream     0.07→0.09  (longer FL vs MW: upper atmosphere affects resolution)
        //   cloudCover    0.30→0.28  (reduced to accommodate jetStream increase)
    },
    {
        // ── ✨ STAR CLUSTERS ──────────────────────────────────────────────
        // Open clusters (naked-eye/binoculars) + globular clusters (high-mag).
        // Most tolerant category — high surface brightness objects.
        // Seeing: open clusters = low importance; globulars = core resolution matters.
        //   Average weight higher than before to reflect globular component.
        // Moon: open clusters easily visible with full moon; globular halos suffer
        //   somewhat. Overall: low moon sensitivity (0.30).
        id: 'cluster',
        emoji: '✨',
        moonSensitivity: 0.30,  // full moon → 70% remaining (grade A or B)
        weights:     { seeing: 0.25, transparency: 0.20, cloudCover: 0.35, wind: 0.10, jetStream: 0.08, convection: 0.02 },
        sensitivity: { seeing: 0.30, transparency: 0.35, cloudCover: 0.55, wind: 0.25, jetStream: 0.20, convection: 0.20 },
        //            sum = 0.25+0.20+0.35+0.10+0.08+0.02 = 1.00 ✓
        //
        //  Changes from v1:
        //   seeing        0.22→0.25  (globular cluster core resolution)
        //   transparency  0.18→0.20  (globular halo visibility)
        //   cloudCover    0.38→0.35  (adjusted for above)
        //   wind          0.12→0.10  (slightly reduced)
    },
    {
        // ── 🔭 GALAXIES ──────────────────────────────────────────────────
        // Lowest surface brightness objects → most demanding of all categories.
        // Transparency/sky darkness is the single most critical factor.
        //   (Difference between Bortle 3 and Bortle 6 is enormous for galaxies)
        // Moon: any significant moonlight washes out galaxy structure.
        //   exponential gate (sensitivity=1.0): half-moon → 25% remaining.
        // Cloud weight reduced to make room for transparency dominance.
        id: 'galaxy',
        emoji: '🔭',
        moonSensitivity: 1.0,   // full moon → ≈0; half moon → 25% remaining
        weights:     { seeing: 0.20, transparency: 0.38, cloudCover: 0.25, wind: 0.08, jetStream: 0.05, convection: 0.04 },
        sensitivity: { seeing: 0.35, transparency: 0.55, cloudCover: 0.55, wind: 0.20, jetStream: 0.25, convection: 0.20 },
        //            sum = 0.20+0.38+0.25+0.08+0.05+0.04 = 1.00 ✓
        //
        //  Changes from v1:
        //   transparency  0.32→0.38  (PRIMARY factor — low SB objects need darkest sky)
        //   cloudCover    0.30→0.25  (transparency increase compensated here)
        //   seeing        0.18→0.20  (detail structure requires decent seeing)
        //   wind          0.10→0.08  (lower than before)
        //   jetStream     0.08→0.05  (moderate focal lengths, less jet stream critical)
        //   convection    0.02→0.04  (long-exposure turbulence sensitivity)
    },
];

// ─────────────────────────────────────────────────────────────────────────────

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
 * moonFraction = 0 (new moon, best) … 1 (full moon, worst)
 *
 *  s = 0        → 1.0 always           (planets: moon ignored)
 *  0 < s < 1   → 1 – fraction × s     (linear, gentle reduction)
 *  s ≥ 1       → (1 – fraction)^(s×2) (exponential, hard gate)
 *
 * Full-moon examples:
 *   planet   (s=0.10): 1 – 1.0×0.10          = 0.90   (10 % reduction)
 *   cluster  (s=0.30): 1 – 1.0×0.30          = 0.70   (30 % reduction)
 *   nebula   (s=0.75): 1 – 1.0×0.75          = 0.25   (75 % reduction)
 *   galaxy   (s=1.00): 0.001^2               ≈ 0.000  (blocked)
 *   milkyway (s=1.50): 0.001^3               ≈ 0.000  (completely blocked)
 */
function getMoonMultiplier(moonFraction: number, sensitivity: number): number {
    if (sensitivity <= 0) return 1.0;
    if (sensitivity >= 1.0) {
        return Math.pow(Math.max(0.001, 1 - moonFraction), sensitivity * 2);
    }
    return Math.max(0, 1 - moonFraction * sensitivity);
}

/**
 * Predict observation suitability for all 5 target types.
 *
 * @param forecast      ForecastItem for the selected time window
 * @param moonFraction  0 = new moon (ideal) … 1 = full moon (worst)
 * @returns             Array of TargetResult, one per target type
 */
export function predictTargets(forecast: ForecastItem, moonFraction: number): TargetResult[] {
    const { scores } = forecast;

    return TARGETS.map(model => {
        // ── Step 1: Exponential quality per atmospheric factor ────────────────
        // quality(val) = exp(−val × k)  →  1.0 when perfect, approaches 0 when terrible
        const qualityMap: Record<string, number> = {};
        for (const [key, k] of Object.entries(model.sensitivity)) {
            const val = (scores as Record<string, number>)[key] ?? 0;
            qualityMap[key] = Math.exp(-val * k);
        }

        // ── Step 2: Weighted atmospheric score (0–1, weights sum to 1.0) ─────
        let atmosphericScore = 0;
        for (const [key, weight] of Object.entries(model.weights)) {
            atmosphericScore += weight * (qualityMap[key] ?? 1);
        }

        // ── Step 3: Moon multiplier ───────────────────────────────────────────
        const moonMult = getMoonMultiplier(moonFraction, model.moonSensitivity);

        // ── Step 4: Final score (atmospheric × moon gate) ────────────────────
        const score = Math.min(100, Math.max(0, Math.round(atmosphericScore * moonMult * 100)));

        // ── Step 5: Primary limiting factor ──────────────────────────────────
        // Metric: (1 – quality) × weight  =  weighted quality loss per factor
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

        // Compare moon's contribution: if it's causing more score loss than
        // any single atmospheric factor, flag it as the limiting factor.
        // Normalisation factor 0.4 keeps moon comparable to atmospheric weights.
        if (model.moonSensitivity > 0) {
            const moonDrop = (1 - moonMult) * model.moonSensitivity * 0.4;
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
