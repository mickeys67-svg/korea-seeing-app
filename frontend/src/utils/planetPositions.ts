import { Body, Observer, Equator, Horizon, SearchRiseSet, MakeTime } from 'astronomy-engine';

export interface PlanetInfo {
    name: string;
    altitude: number;
    azimuth: number;
    rise: Date | null;
    set: Date | null;
    isAboveHorizon: boolean;
}

const PLANETS: { body: Body; nameKey: string }[] = [
    { body: Body.Mercury, nameKey: 'mercury' },
    { body: Body.Venus, nameKey: 'venus' },
    { body: Body.Mars, nameKey: 'mars' },
    { body: Body.Jupiter, nameKey: 'jupiter' },
    { body: Body.Saturn, nameKey: 'saturn' },
];

export function getPlanetPositions(lat: number, lon: number, date: Date = new Date()): PlanetInfo[] {
    const observer = new Observer(lat, lon, 0);
    const time = MakeTime(date);

    return PLANETS.map(({ body, nameKey }) => {
        const equ = Equator(body, time, observer, true, true);
        const hor = Horizon(time, observer, equ.ra, equ.dec, 'normal');

        let rise: Date | null = null;
        let set: Date | null = null;
        try {
            const riseResult = SearchRiseSet(body, observer, +1, time, 1);
            if (riseResult) rise = riseResult.date;
        } catch { /* may not rise */ }
        try {
            const setResult = SearchRiseSet(body, observer, -1, time, 1);
            if (setResult) set = setResult.date;
        } catch { /* may not set */ }

        return {
            name: nameKey,
            altitude: parseFloat(hor.altitude.toFixed(1)),
            azimuth: parseFloat(hor.azimuth.toFixed(1)),
            rise,
            set,
            isAboveHorizon: hor.altitude > 0,
        };
    });
}

export function azimuthToDirection(az: number): string {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(az / 22.5) % 16];
}
