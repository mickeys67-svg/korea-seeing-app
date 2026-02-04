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

    getAstronomyForecast: (startDate, days, lat, lon) => {
        const forecast = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);

            // Adjust calculation for mid-day to ensure correct phase/times for that calendar day
            const noonDate = new Date(date);
            noonDate.setHours(12, 0, 0, 0);

            const moonIllumination = SunCalc.getMoonIllumination(noonDate);
            const moonTimes = SunCalc.getMoonTimes(noonDate, lat, lon);
            const sunTimes = SunCalc.getTimes(noonDate, lat, lon);

            // Calculate observable night duration (Sunset to Next Sunrise)
            let uniqueSunrise = sunTimes.sunrise;
            let uniqueSunset = sunTimes.sunset;

            // For duration, we ideally want time between sunset and *next* sunrise
            // But for simple "Observable" display on that day card: we can just use (24h - dayLength) or Sunset->Sunrise diff
            // If sunset is 18:00 and sunrise is 06:00, night is 12h.
            let observableHours = 0;
            if (uniqueSunset && uniqueSunrise) {
                // Check if valid dates
                if (!isNaN(uniqueSunset) && !isNaN(uniqueSunrise)) {
                    // Simple approximation: 24 - (Sunset - Sunrise in hours) ? 
                    // No, simpler: Next Morning Sunrise - This Evening Sunset.
                    // We need next day's sunrise for precise diff.
                    const nextDay = new Date(noonDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    const nextSunTimes = SunCalc.getTimes(nextDay, lat, lon);
                    if (nextSunTimes.sunrise) {
                        observableHours = (nextSunTimes.sunrise - uniqueSunset) / (1000 * 60 * 60);
                    }
                }
            }

            forecast.push({
                date: date.toISOString().split('T')[0],
                moon: {
                    phase: moonIllumination.phase,
                    fraction: moonIllumination.fraction,
                    rise: moonTimes.rise || null,
                    set: moonTimes.set || null,
                    alwaysUp: moonTimes.alwaysUp,
                    alwaysDown: moonTimes.alwaysDown
                },
                sun: {
                    sunrise: uniqueSunrise || null,
                    sunset: uniqueSunset || null,
                    observableHours: observableHours > 0 ? observableHours : 0
                }
            });

            // Post-processing: If Set is missing (and not always Up/Down), find the next set event from the next day
            const currentItem = forecast[i];
            if (!currentItem.moon.alwaysUp && !currentItem.moon.alwaysDown) {
                if (!currentItem.moon.set) {
                    const nextDayDate = new Date(noonDate);
                    nextDayDate.setDate(nextDayDate.getDate() + 1);
                    const nextMoonTimes = SunCalc.getMoonTimes(nextDayDate, lat, lon);
                    if (nextMoonTimes.set) {
                        currentItem.moon.set = nextMoonTimes.set;
                        // Optional: Add metadata that it is next day? The ISO string contains date.
                    }
                }
                // Logic for missing rise? usually less critical for "tonight" observation if it rose yesterday, but good for consistency.
                if (!currentItem.moon.rise) {
                    // If it didn't rise today, maybe it rises tomorrow?
                    // Or maybe it rose yesterday? Usually users want to know "When does it rise next?"
                    const nextDayDate = new Date(noonDate);
                    nextDayDate.setDate(nextDayDate.getDate() + 1);
                    const nextMoonTimes = SunCalc.getMoonTimes(nextDayDate, lat, lon);
                    if (nextMoonTimes.rise) {
                        currentItem.moon.rise = nextMoonTimes.rise;
                    }
                }
            }
        }
        return forecast;
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
