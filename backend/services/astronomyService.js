/**
 * AstronomyService — Powered by astronomy-engine (VSOP87)
 * High-precision astronomical calculations (+/-1 arcminute, JPL-validated)
 * Replaces SunCalc for more accurate moonrise/moonset/sunrise/sunset times.
 * Cost: $0 | Dependencies: astronomy-engine (MIT, zero-dep)
 */
const Astronomy = require('astronomy-engine');

const AstronomyService = {
    /**
     * 3-day astronomy forecast: moon phase, rise/set, sun rise/set, observable hours.
     * All times are GPS-location-aware via utcOffsetSeconds.
     */
    getAstronomyForecast(startDate, days, lat, lon, utcOffsetSeconds = 0) {
        const observer = new Astronomy.Observer(lat, lon, 0);
        const offsetMs = utcOffsetSeconds * 1000;
        const forecast = [];

        // Convert startDate to local calendar date
        const localRef = new Date(startDate.getTime() + offsetMs);

        for (let i = 0; i < days; i++) {
            // Midnight in LOCAL time for day i (expressed as UTC timestamp)
            const localMidnightMs = Date.UTC(
                localRef.getUTCFullYear(),
                localRef.getUTCMonth(),
                localRef.getUTCDate() + i,
                0, 0, 0, 0
            );
            const midnightUTC = new Date(localMidnightMs - offsetMs);

            // Noon in LOCAL time (for phase calculation — middle of the day)
            const noonUTC = new Date(localMidnightMs + 12 * 3600000 - offsetMs);

            // Date label: local calendar date
            const localDayDate = new Date(localMidnightMs);
            const dateStr = localDayDate.toISOString().split('T')[0];

            // ═══ Moon Phase & Illumination (at local noon) ═══
            const phaseAngle = Astronomy.MoonPhase(noonUTC);    // 0-360 degrees
            const illum = Astronomy.Illumination('Moon', noonUTC);
            const phase = phaseAngle / 360;                      // convert to 0-1 for frontend
            const fraction = illum.phase_fraction;               // 0.0 - 1.0

            // ═══ Moon Rise/Set (search from midnight local, up to 2 days forward) ═══
            const moonRiseResult = Astronomy.SearchRiseSet('Moon', observer, +1, midnightUTC, 2);
            const moonSetResult  = Astronomy.SearchRiseSet('Moon', observer, -1, midnightUTC, 2);

            // Determine alwaysUp / alwaysDown if no events found
            let alwaysUp = false;
            let alwaysDown = false;
            if (!moonRiseResult && !moonSetResult) {
                // Check moon altitude at noon to determine state
                const equ = Astronomy.Equator('Moon', noonUTC, observer, true, true);
                const hor = Astronomy.Horizon(noonUTC, observer, equ.ra, equ.dec, 'normal');
                alwaysUp = hor.altitude > 0;
                alwaysDown = hor.altitude <= 0;
            }

            // ═══ Sun Rise/Set (search from midnight local) ═══
            const sunRiseResult = Astronomy.SearchRiseSet('Sun', observer, +1, midnightUTC, 2);
            const sunSetResult  = Astronomy.SearchRiseSet('Sun', observer, -1, midnightUTC, 2);

            // ═══ Observable Night Duration (Sunset → Next Sunrise) ═══
            let observableHours = 0;
            if (sunSetResult) {
                const nextSunrise = Astronomy.SearchRiseSet('Sun', observer, +1, sunSetResult.date, 1);
                if (nextSunrise) {
                    observableHours = (nextSunrise.date.getTime() - sunSetResult.date.getTime()) / 3600000;
                }
            }

            forecast.push({
                date: dateStr,
                moon: {
                    phase,
                    fraction,
                    rise: moonRiseResult ? moonRiseResult.date.toISOString() : null,
                    set:  moonSetResult  ? moonSetResult.date.toISOString()  : null,
                    alwaysUp,
                    alwaysDown,
                },
                sun: {
                    sunrise: sunRiseResult ? sunRiseResult.date.toISOString() : null,
                    sunset:  sunSetResult  ? sunSetResult.date.toISOString()  : null,
                    observableHours: observableHours > 0 ? observableHours : 0,
                },
            });
        }

        return forecast;
    },

    getMoonPhaseName(phase) {
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
