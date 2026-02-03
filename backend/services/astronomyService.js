const SunCalc = require('suncalc');

const AstronomyService = {
    getMoonData: (date, lat, lon) => {
        const moonIllumination = SunCalc.getMoonIllumination(date);
        const moonTimes = SunCalc.getMoonTimes(date, lat, lon);
        const moonPosition = SunCalc.getMoonPosition(date, lat, lon);

        return {
            phase: moonIllumination.phase, // 0.0 - 1.0 (New Moon -> Full Moon -> New Moon)
            fraction: moonIllumination.fraction, // Illuminated fraction
            angle: moonIllumination.angle,
            rise: moonTimes.rise,
            set: moonTimes.set,
            alwaysUp: moonTimes.alwaysUp || false,
            alwaysDown: moonTimes.alwaysDown || false,
            altitude: moonPosition.altitude,
            azimuth: moonPosition.azimuth
        };
    },

    getMoonPhaseName: (phase) => {
        if (phase === 0 || phase === 1) return 'New Moon';
        if (phase < 0.25) return 'Waxing Crescent';
        if (phase === 0.25) return 'First Quarter';
        if (phase < 0.5) return 'Waxing Gibbous';
        if (phase === 0.5) return 'Full Moon';
        if (phase < 0.75) return 'Waning Gibbous';
        if (phase === 0.75) return 'Last Quarter';
        return 'Waning Crescent';
    }
};

module.exports = AstronomyService;
