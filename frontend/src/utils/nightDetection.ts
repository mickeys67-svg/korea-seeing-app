/**
 * Shared night detection utility.
 * Extracted from AiPrediction and ForecastList to eliminate duplication.
 */
import type { AstronomyDay } from '../types/weather';

/**
 * Determine if a time slot is during nighttime based on astronomy data.
 * Uses actual sunrise/sunset from astronomy-engine when available,
 * falls back to 6AM/6PM heuristic.
 */
export const isNightSlot = (
    isoString: string,
    astronomy: AstronomyDay[] | undefined,
    tz: string
): boolean => {
    const slotTime = new Date(isoString);

    if (astronomy?.length) {
        const localDateStr = slotTime.toLocaleDateString('en-CA', { timeZone: tz });
        const matchDay = astronomy.find(d => d.date === localDateStr);

        if (matchDay?.sun?.sunrise && matchDay?.sun?.sunset) {
            return slotTime < new Date(matchDay.sun.sunrise as string) ||
                   slotTime > new Date(matchDay.sun.sunset as string);
        }
    }

    // Fallback: hour-based heuristic
    const hour = parseInt(
        slotTime.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }),
        10
    );
    return hour < 6 || hour > 18;
};
