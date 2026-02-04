export interface ForecastItem {
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

    // Legacy support (optional or debugging)
    liftedIndex?: number;
    raw?: {
        jetStreamSpeed: number;
        cape: number;
    };
}

export interface MoonData {
    phase: number;
    fraction: number;
    phaseName: string;
    rise: string;
    set: string;
}

export interface WeatherData {
    location: { lat: number; lon: number };
    moon: MoonData;
    forecast: ForecastItem[];
}
