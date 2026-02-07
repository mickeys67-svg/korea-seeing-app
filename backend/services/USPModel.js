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
        const z = (90 - altitudeDeg) * (Math.PI / 180); // Zenith angle in radians
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
        return seeing * Math.pow(USPModel.airmass(altitudeDeg), 3 / 5);
    },

    /**
     * Terrain and environmental correction factors
     */
    environmentFactor: (data) => {
        let factor = 1.0;
        if (data.urban) factor *= 1.15;      // Urban Heat Island (+15%)
        if (data.nearWater) factor *= 0.95;   // Stable water (-5%)
        if (data.elevation > 1000) factor *= 0.8; // High altitude improvement

        // Active Humidity Penalty (Scattering/Absorption)
        if (data.humidity > 85) factor *= 1.15;
        else if (data.humidity > 70) factor *= 1.05;

        // Optical/Air quality factors
        if (data.aod > 0.25) factor *= 1.12;
        if (data.pm25 > 30) factor *= 1.08;

        return factor;
    },

    /**
     * Seeing score (0-10)
     */
    seeingScore: (arcsec) => {
        if (arcsec < 0.5) return 10;
        if (arcsec < 0.8) return 9 + (0.8 - arcsec) * 3.3;
        if (arcsec < 1.2) return 7 + (1.2 - arcsec) * 5;
        if (arcsec < 1.8) return 5 + (1.8 - arcsec) * 3.3;
        if (arcsec < 2.5) return 3 + (2.5 - arcsec) * 2.8;
        return 2;
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
                    layer.tke || 0.15, // Base turbulence floor
                    layer.windShear || 0,
                    layer.ri || 0
                );
                const dz = layer.dz || 1500;
                cn2Integral += cn2 * dz;
            });
        } else {
            // Simplified Fallback
            const baseCn2 = 4.5e-13;
            const windImpact = 1 + Math.pow(data.surfaceWind || 0, 1.2) * 0.05;
            const jetImpact = 1 + (data.jetStreamSpeed || 40) / 100;
            cn2Integral = baseCn2 * windImpact * jetImpact;
        }

        const r0 = USPModel.friedParameter(cn2Integral);
        let seeing = USPModel.seeingArcsec(r0);

        // Apply environmental factors
        seeing *= USPModel.environmentFactor(data);
        const finalSeeing = USPModel.seeingWithAirmass(seeing, data.targetAltitude || 90);

        const score = USPModel.seeingScore(finalSeeing);

        // Dynamic Confidence calculation
        let confidence = 0.98;
        if (!data.layers || data.layers.length === 0) confidence -= 0.3;
        if (data.aod == null) confidence -= 0.05;
        if ((data.variance || 0) > 1.5) confidence -= 0.15;

        return {
            seeing: parseFloat(Math.max(0.35, finalSeeing).toFixed(2)),
            score: parseFloat(score.toFixed(1)),
            confidence: Math.max(10, Math.round(confidence * 100)),
            details: {
                r0: parseFloat((r0 * 100).toFixed(1)),
                stability: data.layers && data.layers.length > 0 ? (data.layers[0].ri > 0 ? 'Stable' : 'Unstable') : 'Mixed',
                jetStream: (data.jetStreamSpeed || 0) > 70 ? 'Extreme' : (data.jetStreamSpeed > 40 ? 'Active' : 'Stable')
            }
        };
    }
};

module.exports = USPModel;
