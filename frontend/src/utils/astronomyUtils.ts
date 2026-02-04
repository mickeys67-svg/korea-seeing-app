import type { AstronomyDay } from '../types/weather';

export const getPhaseDef = (phase: number) => {
    if (phase === 0 || phase === 1) return { name: 'New Moon', class: 'moon-phase-new', icon: '🌑' };
    if (phase < 0.25) return { name: 'Waxing Crescent', class: 'moon-phase-waxing-crescent', icon: '🌒' };
    if (phase === 0.25) return { name: 'First Quarter', class: 'moon-phase-first-quarter', icon: '🌓' };
    if (phase < 0.5) return { name: 'Waxing Gibbous', class: 'moon-phase-waxing-gibbous', icon: '🌔' };
    if (phase === 0.5) return { name: 'Full Moon', class: 'moon-phase-full', icon: '🌕' };
    if (phase < 0.75) return { name: 'Waning Gibbous', class: 'moon-phase-waning-gibbous', icon: '🌖' };
    if (phase === 0.75) return { name: 'Last Quarter', class: 'moon-phase-last-quarter', icon: '🌗' };
    return { name: 'Waning Crescent', class: 'moon-phase-waning-crescent', icon: '🌘' };
};

export const formatDate = (dateStr: string, index: number) => {
    const d = new Date(dateStr);
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const label = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : 'Day after';
    return `${label} (${mm}/${dd})`;
};

export const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--';
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const calculateDuration = (hrs: number) => {
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    return `${h}h ${m}m`;
};

// === Advanced Best Time Logic ===

// Helper: Convert "2024-02-04T18:52:00" or Date object to minutes from midnight of the *start date*
// If the time is on the next day relative to start date, add 1440.
const getMinutesFromStart = (timeStr: string | null, startDateStr: string) => {
    if (!timeStr) return null;
    const t = new Date(timeStr);
    const start = new Date(startDateStr);

    // Reset start to midnight
    start.setHours(0, 0, 0, 0);

    const diffMs = t.getTime() - start.getTime();
    return Math.floor(diffMs / 60000); // ms -> minutes
};

// Helper: Format minutes back to "HH:MM"
export const minutesToTime = (minutes: number) => {
    let m = minutes;
    // Normalize to 0-1440 for display if needed, but we usually want absolute for ranges
    if (m >= 1440) m -= 1440;
    if (m < 0) m += 1440; // Should not happen often in this logic

    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

// Helper: Format duration minutes to "1h 30m"
export const formatDurationMins = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
};

export interface ObservationWindow {
    start: number; // minutes from midnight start
    end: number;
    duration: number;
    quality: 'excellent' | 'good' | 'fair';
    score: number;
    condition: string;
    icon: string;
    tip: string;
}

export const calculateObservationWindows = (currentDay: AstronomyDay, nextDay: AstronomyDay | undefined): ObservationWindow[] => {
    const windows: ObservationWindow[] = [];

    if (!currentDay.sun.sunset) return windows;
    // If no next day (e.g., end of forecast list), we can't accurately calculate night end. 
    // Fallback: Use current day sunrise + 24h as rough estimate or just return empty.
    // Better: Require nextDay. If missing, we skip.
    if (!nextDay || !nextDay.sun.sunrise) return windows;

    const startDateStr = currentDay.date;

    // 1. Define Night Boundaries
    // Start: Sunset + 60m
    const sunsetMins = getMinutesFromStart(currentDay.sun.sunset, startDateStr)!;
    const obsStart = sunsetMins + 60;

    // End: Next Sunrise - 60m
    const sunriseMins = getMinutesFromStart(nextDay.sun.sunrise, startDateStr)!;
    // Note: sunriseMins should be > 1440 naturally if nextDay is correct date.
    // If nextDay is just next in array but date is distinct, getMinutesFromStart handles it.
    const obsEnd = sunriseMins - 60;

    if (obsEnd <= obsStart) return []; // No dark time (e.g., summer high latitude)

    // 2. Moon Events relevant to this night
    // We need to check moon rise/set that happens *during* this night window.
    // Events could come from `currentDay` (late night rise) or `nextDay` (early morning set).

    let moonRise: number | null = null;
    let moonSet: number | null = null;

    // Check Current Day Rise/Set
    if (currentDay.moon.rise) {
        const r = getMinutesFromStart(currentDay.moon.rise, startDateStr)!;
        if (r > sunsetMins - 180) moonRise = r; // Only care if it's near night
    }
    if (currentDay.moon.set) {
        const s = getMinutesFromStart(currentDay.moon.set, startDateStr)!;
        if (s > sunsetMins) moonSet = s;
    }

    // Check Next Day Rise/Set (if not found yet or to overwrite with more relevant one)
    if (nextDay.moon.rise) {
        const r = getMinutesFromStart(nextDay.moon.rise, startDateStr)!;
        if (r < sunriseMins + 180) moonRise = r;
    }
    if (nextDay.moon.set) {
        const s = getMinutesFromStart(nextDay.moon.set, startDateStr)!;
        if (s < sunriseMins + 180) moonSet = s;
    }

    // 3. Logic: Window Slicing based on Moon
    const moonIllumination = currentDay.moon.fraction * 100;
    const isMoonSuperBright = moonIllumination > 70;

    // Determine "Moon Up" status at the start of the night (obsStart)
    // Heuristic: If Moon Set is before Rise, Moon is Up at start.
    let isMoonUpAtStart = false;
    if (moonSet !== null && (moonRise === null || moonSet < moonRise)) {
        isMoonUpAtStart = true;
    } else if (moonRise !== null && (moonSet === null || moonRise < moonSet)) {
        isMoonUpAtStart = false;
    } else if (moonRise === null && moonSet === null) {
        // No proximity events. Use illumination as a fallback proxy for "Always Up/Down"
        isMoonUpAtStart = moonIllumination > 50;
    }

    const windowsList: { start: number, end: number, type: 'dark' | 'moon' }[] = [];

    // Gather and sort events that occur DURING the night window [obsStart, obsEnd]
    const events = [];
    if (moonRise !== null && moonRise > obsStart && moonRise < obsEnd) events.push({ type: 'rise', time: moonRise });
    if (moonSet !== null && moonSet > obsStart && moonSet < obsEnd) events.push({ type: 'set', time: moonSet });
    events.sort((a, b) => a.time - b.time);

    let cursor = obsStart;
    let currentMoonUp = isMoonUpAtStart;

    // Segment the night into Moon-Up and Moon-Down blocks
    for (const event of events) {
        if (!currentMoonUp) {
            // Dark segment from cursor to this Rise event
            if (event.time > cursor + 20) {
                windowsList.push({ start: cursor, end: event.time, type: 'dark' });
            }
        }
        currentMoonUp = (event.type === 'rise');
        cursor = event.time;
    }

    // Final segment from last event to the end of observation window
    if (!currentMoonUp && obsEnd > cursor + 20) {
        windowsList.push({ start: cursor, end: obsEnd, type: 'dark' });
    }

    // fallback for completely dark nights with no events detected
    if (events.length === 0 && !isMoonUpAtStart && windowsList.length === 0 && moonIllumination < 30) {
        if (obsEnd > obsStart + 20) {
            windowsList.push({ start: obsStart, end: obsEnd, type: 'dark' });
        }
    }

    // === Score & Format Windows ===
    return windowsList.map(w => {
        let quality: 'excellent' | 'good' | 'fair' = 'excellent';
        let score = 100;
        let icon = '🌆';
        let tip = 'Optimal dark conditions.';
        let condition = 'Dark Sky';

        // Degrade based on general moon phase even if "down" (scattered light)? 
        // Actually, if moon is down, it's pretty good.
        // But if moon is "Up" but "Dim" (crescent), we might have skipped it above because we only tracked "Dark".
        // Wait, the logic above excludes "Moon Up" times entirely.

        // What if user wants to observe Moon? 
        // The request says "Best Time" = "Deep Sky" context mostly ("Observation").
        // "Scenario B: Moon Sets... Observed after".

        if (w.start <= obsStart + 30) {
            condition = 'Before Moonrise';
            icon = '🌆';
        } else {
            condition = 'After Moonset';
            icon = '🌙';
        }

        // Adjust scores
        if (isMoonSuperBright) {
            // Even if moon is down, if it's full moon night, sky might be brighter near horizon or twilight overlap?
            // Let's keep it simple: Moon Down = Good.
            score = 95;
        }

        // If window is short
        const duration = (w.end - w.start);
        if (duration < 60) {
            score -= 10;
            quality = 'fair';
            tip = 'Short observation window.';
        } else if (duration > 240) {
            score = 100;
            quality = 'excellent';
            tip = 'Long, dark night.';
        } else {
            score = 85;
            quality = 'good';
        }

        return {
            start: w.start,
            end: w.end,
            duration: duration,
            quality,
            score,
            condition,
            icon,
            tip
        };
    });
};

// Helper removed (unused)
