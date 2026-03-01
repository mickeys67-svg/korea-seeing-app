import type { ForecastItem } from '../types/weather';

export type TargetId = 'planet' | 'milkyway' | 'nebula' | 'cluster' | 'galaxy';
export type TargetGrade = 'S' | 'A' | 'B' | 'C' | 'D';
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
     *   0        = immune
     *   0 < s < 1 = linear penalty: moonMult = 1 – fraction × s
     *   s ≥ 1    = exponential gate: moonMult = (1 – fraction)^(s × 2)
     */
    moonSensitivity: number;
    /** Factor weights — each row MUST sum to 1.0 */
    weights: Record<string, number>;
    /**
     * Exponential decay constant k per factor: quality = exp(–val × k)
     * Input: 0 (perfect) → 8 (worst). Output: 1.0 → ~0.
     *
     * Quick reference:
     *   k=0.30, val=2 → 0.549   k=0.40, val=2 → 0.449   k=0.55, val=2 → 0.333
     *   k=0.30, val=4 → 0.301   k=0.40, val=4 → 0.202   k=0.55, val=4 → 0.111
     *   k=0.38, val=4 → 0.217   k=0.58, val=3 → 0.174   k=0.28, val=4 → 0.329
     */
    sensitivity: Record<string, number>;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 *  Five physics-calibrated target models  —  v4.0  (World Standard)
 *
 *  Backend input scales (scoringService.js):
 *   • seeing / transparency : 0-8 continuous  (0 = perfect)
 *   • cloudCover            : 0-8 linear      (0 % → 0, 100 % → 8)
 *   • wind                  : 0-8 surface wind speed proxy
 *   • jetStream             : DISCRETE {0, 2, 4, 6, 8} from 250 hPa wind
 *       0 = < 50 kt   excellent planetary seeing
 *       2 = 50-80 kt  borderline for high-magnification work
 *       4 = 80-120 kt poor planetary; Korea winter typical
 *       6 = 120-150 kt very poor
 *       8 = > 150 kt  extreme (rare)
 *   • convection            : DISCRETE {0, 2, 4, 6, 8} from CAPE (J/kg)
 *       0 = < 100     excellent stability
 *       2 = 100-500   mild (× 0.7 at night → often stays low)
 *       4 = 500-1000  moderate evening convection
 *       6 = 1000-2000 strong (thunderstorm risk)
 *       8 = > 2000    severe
 *
 *  Global reference sources  (v4.0 calibration):
 *   • Damian Peach / Christopher Go / Christoph Pellier planetary studies
 *     — jet stream at 250 hPa is as critical as local seeing for high-mag work
 *     — tropical latitude advantage: jet stream absent below ~25° N
 *   • ESO Paranal site survey & DIMM seeing statistics
 *     — median FWHM 0.66", τ₀ 3.5 ms → calibration anchor for k values
 *   • IDA / Unihedron SQM Bortle-scale dark-sky standards
 *     — sky brightness (transparency) is THE primary Milky Way / galaxy factor
 *   • Cloudy Nights expert consensus (planetary imaging forum)
 *     — jet-stream threshold: < 80 kt for serious planetary work
 *   • Adam Block / Ken Crawford / Rogelio Bernal Andreo galaxy imaging notes
 *     — typical galaxy FL 500-1500 mm → jet stream affects resolution
 *   • Optolong L-eNhance, IDAS NBZT, Antlia ALP-T narrowband filter specs
 *     — Hα + OIII passband blocks > 98 % of broadband sky glow / moonlight
 * ─────────────────────────────────────────────────────────────────────
 */
const TARGETS: TargetModel[] = [
    {
        // ── 🪐 PLANETS ──────────────────────────────────────────────────
        //
        // PRIMARY need: atmospheric stability (seeing + jet stream).
        // Transparency is nearly irrelevant — planets are bright surface-
        // brightness objects; even Bortle 9 city sky allows Jupiter/Saturn.
        //
        // Jet stream at 250 hPa is equally (or more) critical than local seeing:
        //   • Damian Peach images from Barbados specifically because jet stream
        //     is absent at tropical latitudes (~18° N) in winter.
        //   • Korea winter: jet=4 (80-120 kt) → severe upper-atmo turbulence
        //     even when local seeing (surface) appears decent.
        //   • Score check: seeing=1(good) + jet=6(very strong) →
        //     jet should appear as primary limiting factor  ← v4 fix
        //
        // Convection (CAPE): daytime heating creates evening "atmospheric boil".
        //   Summer continental evenings: CAPE 500-1000 J/kg → score=4 → ruins
        //   planetary imaging for 2-4 hours post-sunset.
        //   Increased k: 0.25 → 0.30 for faster penalty per CAPE tier.
        //
        // Wind: at >250× magnification, wind vibration (even gentle breezes)
        //   degrades image. Increased k: 0.25 → 0.30.
        //
        // Moon: contrast reduction, but Jupiter/Saturn/Mars remain usable even
        //   under full moon. Non-zero but small penalty (10 % at full moon).
        //
        id: 'planet',
        emoji: '🪐',
        moonSensitivity: 0.10,
        weights:     { seeing: 0.39, transparency: 0.02, cloudCover: 0.25, wind: 0.10, jetStream: 0.18, convection: 0.06 },
        sensitivity: { seeing: 0.40, transparency: 0.15, cloudCover: 0.55, wind: 0.30, jetStream: 0.38, convection: 0.30 },
        //            ─────────────────────────────────────────────────────────────
        //            weights sum: 0.39+0.02+0.25+0.10+0.18+0.06 = 1.00 ✓
        //
        //  v4 changes vs v2:
        //   jetStream weight  0.15 → 0.18  (planetary killer; dominates on jet=6 nights)
        //   seeing weight     0.40 → 0.39  (reduced to make room for jet stream)
        //   transparency w    0.05 → 0.02  (irrelevant for bright planet discs)
        //   convection weight 0.05 → 0.06  (summer boiling effect)
        //   jetStream k       0.35 → 0.38  (faster decay per 250 hPa wind tier)
        //   wind k            0.25 → 0.30  (vibration at high magnification)
        //   convection k      0.25 → 0.30  (stronger CAPE penalty)
        //
        //  Validation — Korea winter (seeing=2, jet=4, no cloud, no moon):
        //   atm ≈ 0.64 → 63/B  ✓ (decent but jet-limited)
        //  Validation — seeing=1, jet=6 (very strong):
        //   jetStream drop (1-0.102)×0.18=0.162 > seeing drop (1-0.670)×0.39=0.129
        //   → jet correctly identified as primary limiting factor  ✓
    },
    {
        // ── 🌌 MILKY WAY ──────────────────────────────────────────────────
        //
        // Wide-field photography: 14-35 mm lenses, f/1.4-f/2.8, 10-30 s.
        //
        // Sky darkness (transparency) is THE critical metric.
        //   IDA / SQM Bortle-scale: difference between Bortle 3 (21.5 mag/sq")
        //   and Bortle 6 (20.0 mag/sq") is enormous for MW core contrast.
        //   Transparency weight raised 0.37 → 0.40 (primary factor reinforced).
        //
        // Moon: even 10-15 % illumination washes out MW core contrast.
        //   Exponential gate (s = 1.3):
        //     10 % crescent: (0.90)^2.6 = 0.77 → 77 % quality  (thin crescent ok)
        //     20 % crescent: (0.80)^2.6 = 0.56 → 56 % quality  (borderline)
        //     30 % crescent: (0.70)^2.6 = 0.40 → 40 % quality  (difficult)
        //     50 % half-moon: (0.50)^2.6 = 0.19 → 19 % quality (mostly blocked)
        //   Reduced from 1.5 → 1.3: thin crescents are slightly more usable in
        //   practice at dark sites.
        //
        // Seeing: at 14-35 mm, individual star FWHM spans many pixels → irrelevant.
        //   Weight reduced 0.08 → 0.06.
        // Jet stream: completely irrelevant for wide-angle imaging. Weight: 0.04.
        // Wind: at short FL, ground vibration negligible. Weight: 0.04.
        // Convection: matters indirectly via haze / humidity trapping. Weight: 0.08.
        //
        id: 'milkyway',
        emoji: '🌌',
        moonSensitivity: 1.3,
        weights:     { seeing: 0.06, transparency: 0.40, cloudCover: 0.38, wind: 0.04, jetStream: 0.04, convection: 0.08 },
        sensitivity: { seeing: 0.15, transparency: 0.50, cloudCover: 0.55, wind: 0.20, jetStream: 0.10, convection: 0.15 },
        //            weights sum: 0.06+0.40+0.38+0.04+0.04+0.08 = 1.00 ✓
        //
        //  v4 changes vs v2:
        //   moonSensitivity   1.5  → 1.3   (thin crescent slightly more usable)
        //   transparency w    0.37 → 0.40  (Bortle primary factor reinforced)
        //   seeing w          0.08 → 0.06  (wide-field: irrelevant)
        //   wind w            0.05 → 0.04  (negligible at short focal length)
    },
    {
        // ── 💫 NEBULAE ──────────────────────────────────────────────────
        //
        // Emission / reflection / planetary nebulae (mixed population).
        // Typical imaging: 500-1500 mm focal length, 5-20 min/frame stacking.
        //
        // Seeing: at 500-1500 mm, filamentary structures (Veil, Crab, Rosette)
        //   require steady air. Seeing weight raised 0.20 → 0.22.
        //
        // Jet stream: higher weight vs Milky Way due to longer focal lengths.
        //   250 hPa wind at < 80 kt (score 2) can cause measurable blur during
        //   10-min sub-exposures at 1000+ mm FL. Weight raised 0.09 → 0.10.
        //   Sensitivity k raised 0.25 → 0.28 (faster quality loss per tier).
        //
        // Transparency: critical for reflection nebulae (Pleiades, Witch Head)
        //   and faint emission wings. Weight unchanged at 0.32.
        //
        // Moon sensitivity — dual-population calibration:
        //   70 % broadband (DSLR / color OSC): moonSens ≈ 0.85
        //     (full moon → 15 % remaining quality)
        //   30 % narrowband (Optolong L-eNhance, IDAS NBZT, Antlia ALP-T):
        //     Hα (656 nm) + OIII (501 nm) passbands 3-7 nm wide.
        //     Moon is broadband continuum → > 98 % blocked by NB filter.
        //     moonSens ≈ 0.10
        //   Weighted average: 0.70 × 0.85 + 0.30 × 0.10 = 0.625 → 0.70
        //   (kept at 0.70 — captures mix of visual/broadband/NB user base)
        //
        id: 'nebula',
        emoji: '💫',
        moonSensitivity: 0.70,
        weights:     { seeing: 0.22, transparency: 0.32, cloudCover: 0.26, wind: 0.07, jetStream: 0.10, convection: 0.03 },
        sensitivity: { seeing: 0.30, transparency: 0.50, cloudCover: 0.55, wind: 0.20, jetStream: 0.28, convection: 0.20 },
        //            weights sum: 0.22+0.32+0.26+0.07+0.10+0.03 = 1.00 ✓
        //
        //  v4 changes vs v2:
        //   seeing w          0.20 → 0.22  (filamentary structure resolution)
        //   jetStream w       0.09 → 0.10  (medium FL: jet stream matters)
        //   cloudCover w      0.28 → 0.26  (reduced to balance)
        //   wind w            0.08 → 0.07  (slight reduction)
        //   jetStream k       0.25 → 0.28  (faster decay for medium FL)
    },
    {
        // ── ✨ STAR CLUSTERS ─────────────────────────────────────────────
        //
        // Open clusters (naked-eye / binoculars) + globular clusters (high-mag).
        // Most tolerant category — high surface brightness objects.
        //
        // Seeing: bimodal importance.
        //   Open clusters (M45, M44, Hyades): low seeing requirement.
        //   Globular clusters (M13, M3, M5): core star resolution is highly
        //   seeing-dependent. Sub-arcsecond seeing resolves core stars at
        //   >300×; 3" seeing gives featureless ball. Weight raised 0.25 → 0.28.
        //
        // Moon: open clusters visible to naked eye under full moon. Globular
        //   halos suffer somewhat but core remains bright. Reduced 0.30 → 0.25.
        //   Full moon: 1 – 1.0 × 0.25 = 0.75 → score ≈ 75/A  ✓
        //   Half moon: 1 – 0.5 × 0.25 = 0.875 → score ≈ 87.5/S ✓
        //
        // Transparency: reduced weight since clusters are high SB objects.
        //   Weight 0.20 → 0.18.
        //
        id: 'cluster',
        emoji: '✨',
        moonSensitivity: 0.25,
        weights:     { seeing: 0.28, transparency: 0.18, cloudCover: 0.33, wind: 0.10, jetStream: 0.08, convection: 0.03 },
        sensitivity: { seeing: 0.30, transparency: 0.35, cloudCover: 0.55, wind: 0.25, jetStream: 0.20, convection: 0.20 },
        //            weights sum: 0.28+0.18+0.33+0.10+0.08+0.03 = 1.00 ✓
        //
        //  v4 changes vs v2:
        //   moonSensitivity   0.30 → 0.25  (M13/M45/M44 clearly visible with moon)
        //   seeing w          0.25 → 0.28  (globular core resolution)
        //   transparency w    0.20 → 0.18  (high SB; less transparency-dependent)
        //   cloudCover w      0.35 → 0.33  (reduced to balance)
        //   convection w      0.02 → 0.03  (slight increase for completeness)
    },
    {
        // ── 🔭 GALAXIES ──────────────────────────────────────────────────
        //
        // Lowest surface brightness objects — most demanding category overall.
        //
        // Transparency (sky darkness) is the single most critical factor.
        //   Bortle 3 vs Bortle 6 difference is enormous for spiral arms / halos.
        //   Weight raised 0.38 → 0.40. Sensitivity k raised 0.55 → 0.58
        //   (faster quality loss: even modest sky glow washes out outer halos).
        //
        // Moon: any significant moonlight destroys galaxy structure.
        //   Exponential gate (s = 1.0):
        //     20 % crescent : (0.80)² = 0.64 → 64 % quality  (thin crescent ok)
        //     50 % half-moon: (0.50)² = 0.25 → 25 % quality  (very poor)
        //     full moon     : ~0 %  (completely blocked)
        //
        // Jet stream: typical galaxy FL is 500-1500+ mm (RC / Cassegrain).
        //   — Adam Block: 12.5" RC ~1560 mm
        //   — Ken Crawford: 12.5" RC ~1300 mm
        //   — Rogelio Bernal Andreo: 400-900 mm
        //   At these FL, 250 hPa jet stream blur affects sub-exposure sharpness.
        //   Weight raised 0.05 → 0.08. Sensitivity k raised 0.25 → 0.28.
        //
        // Cloud cover: reduced weight 0.25 → 0.22 to accommodate jet and
        //   transparency increases (cloud still punished hard via k=0.55).
        //
        id: 'galaxy',
        emoji: '🔭',
        moonSensitivity: 1.0,
        weights:     { seeing: 0.20, transparency: 0.40, cloudCover: 0.22, wind: 0.07, jetStream: 0.08, convection: 0.03 },
        sensitivity: { seeing: 0.35, transparency: 0.58, cloudCover: 0.55, wind: 0.20, jetStream: 0.28, convection: 0.20 },
        //            weights sum: 0.20+0.40+0.22+0.07+0.08+0.03 = 1.00 ✓
        //
        //  v4 changes vs v2:
        //   transparency w    0.38 → 0.40  (primary factor: low SB dominance)
        //   jetStream w       0.05 → 0.08  (RC/Cassegrain FL: jet stream relevant)
        //   cloudCover w      0.25 → 0.22  (reduced to accommodate above)
        //   wind w            0.08 → 0.07  (slight reduction)
        //   convection w      0.04 → 0.03  (slight reduction)
        //   transparency k    0.55 → 0.58  (faster decay: outer halos demand dark sky)
        //   jetStream k       0.25 → 0.28  (more penalty for long FL imaging)
    },
];

// ─────────────────────────────────────────────────────────────────────────────

function getGrade(score: number): TargetGrade {
    if (score >= 85) return 'S';
    if (score >= 70) return 'A';
    if (score >= 55) return 'B';
    if (score >= 40) return 'C';
    return 'D';
}

/**
 * Compute a moon quality multiplier (0–1).
 *
 * moonFraction = 0 (new moon, best) … 1 (full moon, worst)
 *
 *  s = 0       → 1.0 always             (immune to moon)
 *  0 < s < 1  → 1 – fraction × s       (linear, gentle penalty)
 *  s ≥ 1      → (1 – fraction)^(s × 2) (exponential gate)
 *
 * Full-moon multipliers:
 *   planet   (s=0.10):  1 – 1.0×0.10          = 0.90  ( 10 % reduction)
 *   cluster  (s=0.25):  1 – 1.0×0.25          = 0.75  ( 25 % reduction)
 *   nebula   (s=0.70):  1 – 1.0×0.70          = 0.30  ( 70 % reduction)
 *   galaxy   (s=1.00):  (0.001)^2.0            ≈ 0.000 (completely blocked)
 *   milkyway (s=1.30):  (0.001)^2.6            ≈ 0.000 (completely blocked)
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
        let score = Math.min(100, Math.max(0, Math.round(atmosphericScore * moonMult * 100)));

        // ── Step 4.5: Cloud gate — 하늘이 가리면 별이 안 보임 ────────────────
        const cloudVal = (scores as Record<string, number>).cloudCover ?? 0;

        if (cloudVal >= 7) {
            // 구름 ≥7: 하늘 완전 차단 → 0점, 분석 무의미
            return {
                id: model.id,
                emoji: model.emoji,
                score: 0,
                grade: 'D' as TargetGrade,
                limitingFactor: 'cloudCover' as LimitingFactor,
            };
        }

        if (cloudVal >= 5) {
            // 구름 5-6: 간헐적 관측 → 감소된 점수, 제한요인 = 구름
            score = Math.round(score * 0.5);
        }

        // ── Step 5: Primary limiting factor (하늘이 열렸을 때만) ────────────
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

        // Compare moon's contribution against atmospheric limiting factors.
        // Normalisation factor 0.4 keeps moon comparable to atmospheric weights.
        if (model.moonSensitivity > 0) {
            const moonDrop = (1 - moonMult) * model.moonSensitivity * 0.4;
            if (moonDrop > maxDrop) {
                limitingFactor = 'moon';
            }
        }

        // 구름 5-6: 간헐적이므로 제한요인은 무조건 구름
        if (cloudVal >= 5) {
            limitingFactor = 'cloudCover';
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
