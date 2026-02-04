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
    // const isMoonBright = moonIllumination > 30; // Unused
    const isMoonSuperBright = moonIllumination > 70;

    // Scenario A: Moon doesn't rise or is effectively gone for the night
    if (moonRise === null && moonSet === null) {
        // Full night clear? Or maybe it rose earlier and sets later?
        // Need to check if logic implies "Always Up" or "Always Down".
        // Assumption: if no rise/set found in window, check phase.
        // If New Moon (fraction < 0.1), assume dark. 
        // If Full Moon, assume bright all night if 'alwaysUp' (not provided in this simplified struct).
        // Let's assume 'No Event' + 'Low Illumination' = Dark. 'High' = Bright.
        if (moonIllumination < 10) {
            windows.push(createWindow(obsStart, obsEnd, 'Moonless', 'excellent', 100, '🌆', 'Perfect dark skies.'));
        } else {
            // Moon is present but didn't rise/set *during* night? 
            // Likely already up?
            // Safest to rely on `currentDay.moon.rise` being null meaning "doesn't rise today".
            // If fraction is high and no events, it might be Always Up (Polar) or just risen before sunset and sets after sunrise.
            // Let's calculate purely based on events we found.
            // If we found NO moon rise/set in the night window, and fraction is high, assume BAD.
            // If fraction low, GOOD.
        }
    }

    let windowsList: { start: number, end: number, type: 'dark' | 'moon' }[] = [];

    // Simple Algorithm: Start with full window, subtract moon time.
    // Case 1: Moon Rise is the splitter. (Dark before Rise)
    // Case 2: Moon Set is the splitter. (Dark after Set)
    // Case 3: Moon Set then Moon Rise (Dark between) - Rare in one night unless polar/fast?
    // Case 4: Moon Rise then Moon Set (Moon in middle) - Dark start, Dark end.

    // Let's Normalize Events to be inside the window or boundary
    // const effectiveRise = moonRise !== null ? Math.max(obsStart, Math.min(obsEnd, moonRise)) : null;
    // const effectiveSet = moonSet !== null ? Math.max(obsStart, Math.min(obsEnd, moonSet)) : null;

    // Determine "Moon Up" intervals
    // If Moon Rise is valid and Set is null -> Up from Rise to End
    // If Moon Set is valid and Rise is null -> Up from Start to Set
    // If Both valid -> 
    // If Set < Rise: Up from Start->Set AND Rise->End (Moon sets early, rises late?)
    // If Rise < Set: Up from Rise->Set (Moon passes through)

    // We need to know if moon starts 'Up' or 'Down' at obsStart.
    // Heuristic: If Moon Rise is coming later (and Set is undefined or after Rise), it starts Down.
    // If Moon Set is coming (and Rise is undefined or after Set), it starts Up.

    let isMoonUpAtStart = false;
    // Refine start state logic
    if (moonSet !== null && (moonRise === null || moonSet < moonRise)) {
        isMoonUpAtStart = true;
    } else if (moonRise !== null && (moonSet === null || moonRise < moonSet)) {
        isMoonUpAtStart = false;
    } else {
        // No events. dependent on phase/illumination?
        // Rough proxy: Full Moon = Up all night (approx), New Moon = Down.
    }

    // Construct Intervals
    let cursor = obsStart;

    // We want "Dark" intervals.
    // If moon is Down, we have a window until it Rises or Night Ends.

    // Sort events
    const events = [];
    if (moonRise !== null && moonRise >= obsStart && moonRise <= obsEnd) events.push({ type: 'rise', time: moonRise });
    if (moonSet !== null && moonSet >= obsStart && moonSet <= obsEnd) events.push({ type: 'set', time: moonSet });
    events.sort((a, b) => a.time - b.time);

    let currentMoonState = isMoonUpAtStart; // True if moon is up

    // Start Loop
    for (const event of events) {
        if (!currentMoonState) {
            // Moon was Down (Dark) -> Event must be Rise
            // So [Cursor, Event.time] is a Dark Window
            if (event.time > cursor + 30) { // Min 30 min window
                windowsList.push({ start: cursor, end: event.time, type: 'dark' });
            }
            if (event.type === 'rise') currentMoonState = true;
        } else {
            // Moon was Up (Bright) -> Event must be Set
            // So [Cursor, Event.time] was Bright (Ignore)
            if (event.type === 'set') currentMoonState = false;
        }
        cursor = event.time;
    }

    // Final Segment
    if (!currentMoonState && cursor < obsEnd) {
        if (obsEnd - cursor > 30) {
            windowsList.push({ start: cursor, end: obsEnd, type: 'dark' });
        }
    }

    // If no events and moon was NOT up at start (Low illumination or just not up), add full window
    if (events.length === 0 && !isMoonUpAtStart && moonIllumination < 10) {
        windowsList.push({ start: obsStart, end: obsEnd, type: 'dark' });
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

function createWindow(start: number, end: number, condition: string, quality: any, score: number, icon: string, tip: string): ObservationWindow {
    return { start, end, duration: end - start, condition, quality, score, icon, tip };
}
