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
        if (data.urban) factor *= 1.15;      // Urban Heat Island (+15% seeing degradation)
        if (data.nearWater) factor *= 0.9;   // Proximity to water (often stabilizes air, -10%)
        if (data.elevation > 500) factor *= 0.85; // High altitude (-15% improvement)

        // Optical/Air quality factors
        if (data.aod > 0.3) factor *= 1.1;   // High AOD degrades transparency/seeing
        if (data.pm25 > 35) factor *= 1.05;  // PM levels

        return factor;
    },

    /**
     * Seeing score (0-10)
     */
    seeingScore: (arcsec) => {
        if (arcsec < 0.6) return 10;
        if (arcsec < 1.0) return 8 + (1.0 - arcsec) * 5; // Linear interpolation
        if (arcsec < 1.5) return 6 + (1.5 - arcsec) * 4;
        if (arcsec < 2.0) return 4 + (2.0 - arcsec) * 4;
        if (arcsec < 3.0) return 2 + (3.0 - arcsec) * 2;
        return 2;
    },

    /**
     * Main Engine
     */
    calculate: (data) => {
        const cn2Layers = [];
        let cn2Integral = 0;

        // Process vertical layers
        if (data.layers && data.layers.length > 0) {
            data.layers.forEach(layer => {
                const cn2 = USPModel.cn2Proxy(layer.tke, layer.windShear, layer.ri);
                cn2Layers.push(cn2);
                // Integration: Cn2(h) * dh
                // If weight is dz (meters), we get m^(1/3)
                const dz = layer.dz || (layer.weight * 12000); // weight was dz/12000
                cn2Integral += cn2 * dz;
            });
        } else {
            // Fallback to surface/simplified data if no profile
            // Use a base Cn2 integral that leads to ~15cm r0 (seeing ~0.8")
            cn2Integral = 5e-13 * (1 + data.surfaceWind * 0.1 + (data.jetStreamSpeed || 0) / 100);
        }

        const r0 = USPModel.friedParameter(cn2Integral);
        let seeing = USPModel.seeingArcsec(r0);

        // Corrections
        seeing *= USPModel.environmentFactor(data);
        const finalSeeing = USPModel.seeingWithAirmass(seeing, data.targetAltitude || 90);

        const score = USPModel.seeingScore(finalSeeing);

        // Confidence Calculation
        let confidence = 0.95;
        if (!data.layers) confidence -= 0.3; // No profile data reduces confidence
        if (data.aod == null) confidence -= 0.05;
        if (data.variance > 0.5) confidence -= 0.1;

        return {
            seeing: parseFloat(finalSeeing.toFixed(2)),
            score: parseFloat(score.toFixed(1)),
            confidence: Math.round(confidence * 100),
            details: {
                r0: parseFloat((r0 * 100).toFixed(1)), // cm
                stability: data.layers ? (data.layers[0].ri > 0 ? 'Stable' : 'Unstable') : 'Unknown',
                jetStream: data.jetStreamSpeed > 40 ? 'Strong' : 'Weak'
            }
        };
    }
};

module.exports = USPModel;
