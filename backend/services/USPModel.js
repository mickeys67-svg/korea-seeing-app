/**
 * Ultimate Seeing Prediction Model (USP-Model v1.0)
 * Physics-based + Data-driven Hybrid Model
 */

const USPModel = {
    /**
     * Cn2 Proxy Model: Estimating turbulence using physics proxies
     * @param {number} tke - Turbulent Kinetic Energy
     * @param {number} windShear - Wind Shear |du/dz|
     * @param {number} ri - Richardson Number
     * @returns {number} Estimated Cn2 value for the layer
     */
    cn2Proxy: (tke, windShear, ri) => {
        // Stability factor based on Richardson Number
        let stability = 1.2;
        if (ri > 0.25) stability = 1.0;      // Stable
        else if (ri < 0) stability = 1.5;    // Unstable/Convective

        // Proxy scale to match typical Cn2 values (approx 10^-15 to 10^-17)
        // v3.5: Kept at 5e-16 — Ri fix (θ-based potential temperature) corrected layer
        // stability classification, so TKE/stability values are now physically accurate.
        // Calibration test: SCALE=5e-16 → calm=1.21", avg=2.36" (matches observations)
        const SCALE = 5e-16;
        // C_n^2(h) = (0.6 * TKE + 0.3 * Shear) * Stability * SCALE
        return (0.6 * tke + 0.3 * Math.abs(windShear)) * stability * SCALE;
    },

    /**
     * Fried Parameter r0 Calculation
     * @param {number} cn2Integral - Integrated Cn2 over the entire atmosphere
     * @param {number} wavelength - Wavelength in meters (default 550nm)
     * @returns {number} Fried parameter in meters
     */
    friedParameter: (cn2Integral, wavelength = 550e-9) => {
        if (cn2Integral <= 0) return 0.2; // Default 20cm if no turbulence data
        const constant = 0.423 * Math.pow((2 * Math.PI) / wavelength, 2);
        return Math.pow(constant * cn2Integral, -3 / 5);
    },

    /**
     * Seeing calculation in arcseconds
     * @param {number} r0 - Fried parameter in meters
     * @param {number} wavelength - Wavelength in meters
     * @returns {number} Seeing in arcseconds
     */
    seeingArcsec: (r0, wavelength = 550e-9) => {
        if (!r0 || r0 <= 0) return 2.0;
        // 0.98 * lambda / r0 * 206265 (radians to arcsec conversion)
        return (0.98 * wavelength / r0) * 206265;
    },

    /**
     * Airmass correction based on altitude
     * @param {number} altitudeDeg - Altitude in degrees
     * @returns {number} Airmass
     */
    airmass: (altitudeDeg) => {
        // Guard against near-horizon: cap at 5° to avoid extreme/infinite values
        const safeDeg = Math.max(5, altitudeDeg);
        const z = (90 - safeDeg) * (Math.PI / 180); // Zenith angle in radians
        return 1 / Math.cos(z);
    },

    /**
     * Correct seeing for airmass
     * @param {number} seeing - Base seeing at zenith
     * @param {number} altitudeDeg - Target altitude in degrees
     */
    seeingWithAirmass: (seeing, altitudeDeg) => {
        if (altitudeDeg >= 90) return seeing;
        if (altitudeDeg <= 0) return 5.0; // Horizon is always bad
        // Cap at 5.0 arcsec — beyond this is "observation impossible" territory
        return Math.min(5.0, seeing * Math.pow(USPModel.airmass(altitudeDeg), 3 / 5));
    },

    /**
     * Terrain and environmental correction factors
     */
    // ═══ v4.0: seeing에 영향을 주는 요소만 남김 ═══
    // 습도/AOD/PM2.5 → transparency에서만 처리 (이중 계산 제거)
    // seeing에 남는 것: 도시 열섬, 고도, 해안 효과 (대기 난류 직접 영향)
    environmentFactor: (data) => {
        let factor = 1.0;
        if (data.urban) factor *= 1.15;      // Urban Heat Island (+15%)
        if (data.elevation > 1000) factor *= 0.8; // High altitude improvement

        // v3.1: Coastal marine boundary layer stabilization
        if (data.isCoastal && (data.surfaceWind || 0) < 8) factor *= 0.92;

        return factor;
    },

    /**
     * Seeing score (0-10) from arcseconds
     * <0.5" = 10 (Exceptional), <0.8" = 9-10, <1.2" = 7-9, <1.8" = 5-7,
     * <2.5" = 3-5, <4.0" = 1-3, <5.0" = 0-1, ≥5.0" = 0 (Extreme turbulence/typhoon)
     * @param {number} arcsec - Seeing in arcseconds
     * @returns {number} Score 0-10 (higher = better)
     */
    seeingScore: (arcsec) => {
        let score;
        if (arcsec < 0.5) score = 10;
        else if (arcsec < 0.8) score = 9 + (0.8 - arcsec) * 3.3;
        else if (arcsec < 1.2) score = 7 + (1.2 - arcsec) * 5;
        else if (arcsec < 1.8) score = 5 + (1.8 - arcsec) * 3.3;
        else if (arcsec < 2.5) score = 3 + (2.5 - arcsec) * 2.8;
        else if (arcsec < 4.0) score = 1 + (4.0 - arcsec) * 1.3;
        else if (arcsec < 5.0) score = (5.0 - arcsec) * 1.0;
        else score = 0;
        return Math.min(10, Math.max(0, score));
    },

    /**
     * Main Engine - Calculates precision seeing metrics
     */
    calculate: (data = {}) => {
        let cn2Integral = 0;

        // Process vertical layers
        if (data.layers && Array.isArray(data.layers) && data.layers.length > 0) {
            data.layers.forEach(layer => {
                const cn2 = USPModel.cn2Proxy(
                    layer.tke || 0.08, // Base turbulence floor (lowered for stable night)
                    layer.windShear || 0,
                    layer.ri || 0
                );
                const dz = layer.dz || 1500;
                cn2Integral += cn2 * dz;
            });
        } else {
            // Simplified Fallback — adjust baseCn2 by elevation only
            // v4.0: 습도 → transparency에서만 처리 (이중 계산 제거)
            let baseCn2 = 4.5e-13;
            if (data.elevation > 1000) baseCn2 *= 0.5;      // high altitude = cleaner air
            const windImpact = 1 + Math.pow(data.surfaceWind || 0, 1.2) * 0.05;
            const jetKt = data.jetStreamSpeed ?? 25;
            const jetImpact = 1 + Math.log1p(jetKt / 80) * 0.6;
            cn2Integral = baseCn2 * windImpact * jetImpact;
        }

        const r0 = USPModel.friedParameter(cn2Integral);
        let seeing = USPModel.seeingArcsec(r0);

        // Apply environmental factors
        seeing *= USPModel.environmentFactor(data);
        const finalSeeing = USPModel.seeingWithAirmass(seeing, data.targetAltitude || 90);

        const score = USPModel.seeingScore(finalSeeing);

        // v3.1: τ₀ coherence time (Roddier 1981, TMT/ELT standard)
        // τ₀ = 0.314 × r₀ / v_eff — determines planetary imaging exposure time
        // v_eff = effective wind at turbulent layer ≈ jet stream × 0.4
        const jetMs = (data.jetStreamSpeed ?? 25) * 0.5144; // kt → m/s
        const vEff = Math.max(2, jetMs * 0.4); // effective wind (min 2 m/s)
        const tau0 = r0 > 0 ? (0.314 * r0 / vEff) * 1000 : 5; // ms

        // Dynamic Confidence — reflects actual data quality & diversity
        let confidence = 0.50; // base
        if (data.layers && data.layers.length > 0) confidence += 0.25;  // has vertical profiles
        if (data.layers && data.layers.length >= 5) confidence += 0.10; // full profile (5+ layers)
        if (data.aod != null) confidence += 0.05;                       // has air quality
        if (data.pm25 != null) confidence += 0.03;                      // has PM2.5
        if (data.humidity != null) confidence += 0.02;                  // has humidity
        if (typeof data.variance === 'number' && !isNaN(data.variance) && data.variance <= 1.0) confidence += 0.05;

        return {
            seeing: parseFloat(Math.min(5.0, Math.max(0.35, finalSeeing)).toFixed(2)),
            score: parseFloat(score.toFixed(1)),
            confidence: Math.round(confidence * 100),
            details: {
                r0: parseFloat((r0 * 100).toFixed(1)),
                stability: data.layers && data.layers.length > 0 && data.layers[0].ri != null ? (data.layers[0].ri > 0 ? 'Stable' : 'Unstable') : 'Mixed',
                jetStream: (data.jetStreamSpeed ?? 0) > 70 ? 'Extreme' : ((data.jetStreamSpeed ?? 0) > 40 ? 'Active' : 'Stable'),
                tau0: parseFloat(Math.max(0.5, Math.min(50, tau0)).toFixed(1)) // ms, clamped
            }
        };
    }
};

module.exports = USPModel;
