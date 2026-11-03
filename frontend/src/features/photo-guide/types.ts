/**
 * v5.0 Photo Guide — TypeScript types
 *
 * Backend /api/photo-forecast 응답 형태.
 * backend/services/photo/photoService.js 의 출력과 1:1 대응.
 */

export type CategoryId =
    | 'general'
    | 'longExposure'
    | 'fogSubject'
    | 'skyColor'
    | 'mudflat'
    | 'phenomena';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
export type Palette = 'burning' | 'vivid' | 'pastel' | 'muted';

// ─── Weather slot (backend photoSlot.weather) ─────────────
export interface PhotoWeather {
    temp2m: number | null;
    relativeHumidity: number | null;
    windSpeed: number | null;
    windDirection: string | null;
    cloudCoverLow: number | null;
    cloudCoverMid: number | null;
    cloudCoverHigh: number | null;
    cloudCoverTotal: number | null;
    dewPointSpread: number | null;
    jetStreamSpeed: number | null;
    cape: number | null;
    visibility: number | null;
    precipitation: number | null;
    precipProb: number | null;
    windGusts: number | null;
    uvIndex: number | null;
    surfacePressure: number | null;
    isDay: number | null;
}

// ─── Solar context for a slot ──────────────────────────────
export interface PhotoSolar {
    phase: string;
    sunAltitude: number | null;
    sunAzimuth: number | null;
    isGoldenHour: boolean;
    isBlueHour: boolean;
    isBeltOfVenus: boolean;
    isDay: boolean;
    isNight: boolean;
}

export interface PhotoMoon {
    moonFraction: number | null;
    moonMagnitude: number | null;
}

// ─── Category result common shape ─────────────────────────
export interface CategoryResultBase {
    score: number;
    grade: Grade;
    raw: number;
    error?: boolean;
}

// Sky Color specifics
export interface SkyColorBar {
    value?: number;
    score: number;
    label: string;
}
export interface SkyColorResult extends CategoryResultBase {
    palette: Palette;
    paletteIcon: string;
    colorDirection: string | null;
    isActiveTime: boolean;
    goldenHourWindow: { start: string; end: string } | null;
    blueHourWindow:   { start: string; end: string } | null;
    beltOfVenusWindow: { start: string; end: string } | null;
    alpenGlowWindow:  { start: string; end: string } | null;
    breakdown: Record<string, SkyColorBar>;
    factors?: Record<string, unknown>;
}

// General / LongExp / Fog / Mudflat — lightweight
export interface SubjectRef {
    id: string;
    score: number;
    shutter?: { min: number; max: number; unit: string };
}
export interface GeneralResult extends CategoryResultBase {
    bestSubjects: SubjectRef[];
    moodTags: string[];
    breakdown?: Record<string, { score: number; label: string; value?: number | null; phase?: string | null }>;
    factors?: Record<string, unknown>;
}
export interface LongExposureResult extends CategoryResultBase {
    bestSubjects: SubjectRef[];
    breakdown?: Record<string, { score: number; label: string; value?: number | null; id?: string | null }>;
    factors?: Record<string, unknown>;
}
export interface FogSubjectResult extends CategoryResultBase {
    fogType: string | null;
    bestSubjects: SubjectRef[];
    breakdown?: Record<string, { score: number; label: string; value?: number | null }>;
    factors?: Record<string, unknown>;
}
export interface MudflatResult extends CategoryResultBase {
    available: boolean;
    reason?: string;
    region?: string;
    tideEvent: unknown | null;
    reflectionWindow: unknown | null;
    bestSubjects: SubjectRef[];
    breakdown?: Record<string, { score: number; label: string; value?: number | null; phase?: string | null }>;
    factors?: Record<string, unknown>;
}

// Phenomena slot-level
export interface OpticalEvent {
    id: string;
    direction: string;
}
export interface LinkedPhenomenon {
    type: string;
    date: string;
    peakTime: string;
    visible?: boolean;
    altitude?: number | null;
    azimuth?: number | null;
    direction?: string | null;
    dDay: number;
    [key: string]: unknown;
}
export interface PhenomenaResult extends CategoryResultBase {
    opticalEvents: OpticalEvent[];
    linkedPhenomena: LinkedPhenomenon[];
}

export interface PhotoCategories {
    general: GeneralResult;
    longExposure: LongExposureResult;
    fogSubject: FogSubjectResult;
    skyColor: SkyColorResult;
    mudflat: MudflatResult;
    phenomena: PhenomenaResult;
}

// ─── Slot-level suggestion ─────────────────────────────────
export interface Suggestion {
    id: string;
    topic: string;
    textKey: string;
    score: number;
}

// ─── Full photo slot ───────────────────────────────────────
export interface PhotoSlot {
    time: string;
    weather: PhotoWeather;
    solar: PhotoSolar | null;
    moon: PhotoMoon;
    categories: PhotoCategories;
    suggestions: Suggestion[];
}

// ─── Top-level insights (1층) ──────────────────────────────
export interface TopSuggestionSky {
    id: 'next-sky-color';
    type: 'sky-color';
    time: string;
    score: number;
    palette: Palette;
    paletteIcon: string;
    direction: string | null;
    textKey: string;
}
export interface TopSuggestionFog {
    id: 'next-fog-opportunity';
    type: 'fog';
    time: string;
    score: number;
    fogType: string | null;
    textKey: string;
}
export interface TopSuggestionPhenomenon {
    id: 'nearest-phenomenon';
    type: 'phenomenon';
    subtype: string;
    date: string;
    peakTime: string;
    dDay: number;
    direction: string | null;
    textKey: string;
}
export type TopSuggestion = TopSuggestionSky | TopSuggestionFog | TopSuggestionPhenomenon;

// ─── Twilight day ──────────────────────────────────────────
export interface TwilightWindow { start: string; end: string }
export interface TwilightDay {
    date: string;
    dawn: {
        astronomical: string | null;
        nautical: string | null;
        civil: string | null;
        blueHour: TwilightWindow | null;
        goldenHour: TwilightWindow | null;
        sunrise: string | null;
    };
    dusk: {
        sunset: string | null;
        goldenHour: TwilightWindow | null;
        blueHour: TwilightWindow | null;
        beltOfVenus: TwilightWindow | null;
        alpenGlow: TwilightWindow | null;
        civil: string | null;
        nautical: string | null;
        astronomical: string | null;
    };
}

// ─── Phenomena calendar entry ──────────────────────────────
export type PhenomenaCalendarEntry = LinkedPhenomenon;

// ─── Full response ─────────────────────────────────────────
export interface PhotoForecast {
    location: {
        lat: number;
        lon: number;
        elevation: number;
        isCoastal: boolean;
        timezone: string;
        timezoneOffset: number;
    };
    forecast: PhotoSlot[];
    twilight: TwilightDay[];
    phenomena: PhenomenaCalendarEntry[];
    topSuggestionsNow: TopSuggestion[];
    meta: {
        version: string;
        mode: 'full' | 'limited' | 'error';
        hasPhotoVars?: boolean;
        hasWeatherData?: boolean;
        reason?: string;
        generatedAt: string;
        ruleCount?: number;
    };
}
