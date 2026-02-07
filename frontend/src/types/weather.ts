export interface ForecastItem {
    time: string;
    timepoint: number;

    // Display Values
    temp2m: number;
    rh2m: number;
    wind10m: { direction: string; speed: number };

    // Scoring Components (0 = Best, 8 = Worst)
    scores: {
        seeing: number;
        transparency: number;
        cloudCover: number;
        wind: number;
        jetStream: number;
        convection: number;
    };

    // Final Assessment (0-100, Higher is Better)
    score: number;
    grade: string;
    recommendation: string;

    usp?: {
        seeing: number;
        score: number;
        confidence: number;
        details: {
            r0: number;
            stability: string;
            jetStream: string;
        };
    };
    raw?: {
        jetStreamSpeed: number;
        cape: number;
        confidence?: number;
    };
}

export interface MoonData {
    phase: number;
    fraction: number;
    phaseName: string;
    rise: string;
    set: string;
}

// 3-Day Astronomy Forecast
export interface AstronomyDay {
    date: string;
    moon: {
        phase: number;
        fraction: number;
        rise: string | null;
        set: string | null;
        alwaysUp?: boolean;
        alwaysDown?: boolean;
    };
    sun: {
        sunrise: string | null;
        sunset: string | null;
        observableHours: number;
        alwaysUp?: boolean;
        alwaysDown?: boolean;
    };
}

export interface WeatherData {
    location: {
        lat: number;
        lon: number;
        timezone?: string;
        timezoneOffset?: number;
    };
    weather: ForecastItem[];
    forecast: ForecastItem[];
    astronomy: AstronomyDay[];
    aiSummary?: string | null;
}
