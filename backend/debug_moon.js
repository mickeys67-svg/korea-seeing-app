const SunCalc = require('suncalc');

// Coordinates for Seoul
const lat = 37.5665;
const lon = 126.9780;

// Simulate dates
// User is in Korea (GMT+9). 
// Test Date 1: Feb 4, 2026 (Today)
// Test Date 2: Feb 10, 2026 (+6 days)

function testDate(dString, label) {
    console.log(`\n=== Testing ${label}: ${dString} ===`);
    const date = new Date(dString);
    date.setHours(12, 0, 0, 0); // Noon logic from service

    const times = SunCalc.getMoonTimes(date, lat, lon);
    const sunTimes = SunCalc.getTimes(date, lat, lon);
    const illumination = SunCalc.getMoonIllumination(date);

    console.log("SunCalc.getMoonTimes (Today):");
    console.log("  Rise:", times.rise ? times.rise.toLocaleString() : "NULL");
    console.log("  Set :", times.set ? times.set.toLocaleString() : "NULL");
    console.log("  AlwaysUp:", times.alwaysUp);
    console.log("  AlwaysDown:", times.alwaysDown);

    console.log("SunCalc.getMoonIllumination:");
    console.log("  Phase:", illumination.phase.toFixed(2));
    console.log("  Fraction:", illumination.fraction.toFixed(2));

    if (!times.set) {
        console.log("  [!] Set is missing. Checking Tomorrow...");
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextTimes = SunCalc.getMoonTimes(nextDay, lat, lon);
        console.log("  Next Day Set:", nextTimes.set ? nextTimes.set.toLocaleString() : "NULL");
    }

    console.log("SunCalc.getTimes (Sun):");
    console.log("  Sunset:", sunTimes.sunset ? sunTimes.sunset.toLocaleString() : "NULL");
    console.log("  Sunrise:", sunTimes.sunrise ? sunTimes.sunrise.toLocaleString() : "NULL"); // Note: This is sunrise of TODAY. Night ends with TOMORROW sunrise.

    // Check Next Morning Sunrise (for night window)
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextSunTimes = SunCalc.getTimes(nextDay, lat, lon);
    console.log("  Next Morning Sunrise:", nextSunTimes.sunrise ? nextSunTimes.sunrise.toLocaleString() : "NULL");

    return { times, sunTimes, nextSunTimes, nextDay };
}

testDate('2026-02-04', 'Today (Missing Moon Set?)');
testDate('2026-02-10', 'Day +6 (Best Time Issue)');
