import { AstronomyDay } from '../types/weather';

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

export const getBestTimeData = (day: AstronomyDay) => {
    if (!day.sun.sunset) return null;

    const sunsetDate = new Date(day.sun.sunset);
    const start = new Date(sunsetDate);
    start.setHours(start.getHours() + 1);

    const end = new Date(sunsetDate);
    let duration = 3;

    if (day.moon.fraction > 0.7) {
        duration = 1.5;
    } else if (day.moon.fraction > 0.3) {
        duration = 2.5;
    }

    end.setMinutes(end.getMinutes() + (duration * 60));

    // Score logic (0-100)
    let score = 50;
    if (day.moon.fraction < 0.1) score = 100;
    else if (day.moon.fraction < 0.3) score = 80;
    else if (day.moon.fraction < 0.6) score = 60;
    else score = 30;

    let quality = 'Fair';
    let badgeClass = 'fair';
    if (score >= 80) { quality = 'Excellent'; badgeClass = 'excellent'; }
    else if (score >= 60) { quality = 'Good'; badgeClass = 'good'; }

    return {
        start: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        end: end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        score,
        quality,
        badgeClass
    };
};
