/**
 * v5.1 Photo Guide — Object-centric extractor
 *
 * Backend /api/photo-forecast 응답을 "사진 오브제" 7개로 재구성한다.
 *   1. ☀️ 빛 (Light)       — 시간 축: 골든/블루/직광/밤
 *   2. 🌇 하늘 색 (SkyColor) — 질 축:  burning/vivid/pastel/muted
 *   3. ☁️ 구름 (Clouds)     — 드라마틱 / 평탄 / 맑음
 *   4. 🌫 안개 (Fog)        — 복사 / 해무 / 계곡 / 산악
 *   5. 💨 바람 (Wind)       — 무풍 / 잔잔 / 바람 / 강풍
 *   6. 🌙 달 (Moon)         — 삭 / 반달 / 보름 + 근접 phenomena
 *   7. 👀 시정 (Visibility)  — 초청명 / 양호 / 보통 / 저시정
 *
 * 각 오브제는 "지금 / 곧 / 추천" 3단 정보 + 등급(S/A/B/C) + 카드 색.
 */
import type { PhotoForecast, PhotoSlot, PhenomenaCalendarEntry } from './types';
import type { PhotoGuideI18n } from './i18n';
import { formatRelativeTime } from './momentExtractor';

// ─── Public types ───────────────────────────────────────────
export type ObjectId =
    | 'light'
    | 'skyColor'
    | 'clouds'
    | 'fog'
    | 'wind'
    | 'moon'
    | 'visibility';

export type Grade = 'S' | 'A' | 'B' | 'C';

export interface PhotoObject {
    id: ObjectId;
    icon: string;             // emoji
    name: string;             // i18n 이름
    grade: Grade;
    accent: string;           // CSS 컬러 (테두리·하이라이트)
    gradient: string;         // HERO background-image
    nowText: string;          // "저녁 골든아워", "드라마틱 구름" (화면 표시용 번역 문구)
    nowStateKey?: string;     // 분류 상태 키('duskGolden','burning','dramatic'…) — 언어 무관 로직 판정용
    nowValue?: string;        // "42%", "2.3 m/s" 등 수치
    nextText?: string;        // "폭발적 일몰"
    nextWhenLabel?: string;   // "3시간 후", "내일 05:30"
    hintText: string;         // "역광 실루엣 · WB 4500K"
    hintExtra?: string;       // 두번째 줄 힌트 (카메라 설정 등)
    sortScore: number;        // 내부 정렬용
}

export interface PhotoWarning {
    id: 'strongWind' | 'gust' | 'condensation' | 'cold' | 'uv';
    text: string;
}

// ─── Color palette per object ───────────────────────────────
const COLORS: Record<ObjectId, { accent: string; gradient: string }> = {
    light: {
        accent: '#f59e0b',
        gradient: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(251,191,36,0.08))',
    },
    skyColor: {
        accent: '#f97316',
        gradient: 'linear-gradient(135deg, rgba(249,115,22,0.28), rgba(244,114,182,0.10))',
    },
    clouds: {
        accent: '#94a3b8',
        gradient: 'linear-gradient(135deg, rgba(148,163,184,0.22), rgba(30,41,59,0.10))',
    },
    fog: {
        accent: '#6ee7b7',
        gradient: 'linear-gradient(135deg, rgba(110,231,183,0.22), rgba(20,184,166,0.08))',
    },
    wind: {
        accent: '#60a5fa',
        gradient: 'linear-gradient(135deg, rgba(96,165,250,0.22), rgba(59,130,246,0.08))',
    },
    moon: {
        accent: '#c084fc',
        gradient: 'linear-gradient(135deg, rgba(192,132,252,0.22), rgba(56,189,248,0.10))',
    },
    visibility: {
        accent: '#38bdf8',
        gradient: 'linear-gradient(135deg, rgba(56,189,248,0.22), rgba(14,165,233,0.08))',
    },
};

// ─── Grade thresholds ───────────────────────────────────────
const GRADE_SCORE: Record<Grade, number> = { S: 90, A: 70, B: 40, C: 10 };

function gradeFromScore(score: number): Grade {
    if (score >= GRADE_SCORE.S) return 'S';
    if (score >= GRADE_SCORE.A) return 'A';
    if (score >= GRADE_SCORE.B) return 'B';
    return 'C';
}

// ─── Slot helpers ───────────────────────────────────────────
function nowSlot(data: PhotoForecast): PhotoSlot | null {
    const slots = data.forecast || [];
    if (slots.length === 0) return null;
    const now = Date.now();
    // 가장 가까운 과거 또는 현재 슬롯 우선, 없으면 최초 미래 슬롯
    let best: PhotoSlot | null = null;
    let bestDelta = Infinity;
    for (const s of slots) {
        const t = new Date(s.time).getTime();
        if (isNaN(t)) continue;
        const delta = Math.abs(t - now);
        if (delta < bestDelta) {
            bestDelta = delta;
            best = s;
        }
    }
    return best ?? slots[0];
}

function futureSlots(data: PhotoForecast): PhotoSlot[] {
    const now = Date.now();
    return (data.forecast || []).filter((s) => {
        const t = new Date(s.time).getTime();
        return !isNaN(t) && t >= now - 30 * 60 * 1000;
    });
}

// ─── Light extractor ────────────────────────────────────────
type LightState = keyof PhotoGuideI18n['object']['light']['state'];

function classifyLight(slot: PhotoSlot): LightState {
    const phase = slot.solar?.phase;
    const hour = new Date(slot.time).getUTCHours();
    if (phase === 'goldenHourDawn') return 'dawnGolden';
    if (phase === 'goldenHourDusk') return 'duskGolden';
    if (phase === 'blueHourDawn') return 'dawnBlue';
    if (phase === 'blueHourDusk') return 'duskBlue';
    if (phase === 'beltOfVenus' || phase === 'twilight') return 'twilight';
    if (phase === 'night') return 'night';
    if (phase === 'day') {
        const cloudTotal = slot.weather.cloudCoverTotal ?? 0;
        if (cloudTotal < 20 && hour >= 2 && hour <= 6) return 'dayHarsh';
        // Local noon: tz-aware but crude — use "harsh" only when clear sky
        return 'dayNormal';
    }
    return 'dayNormal';
}

function extractLight(
    data: PhotoForecast,
    t: PhotoGuideI18n,
    locale: string,
): PhotoObject {
    const slot = nowSlot(data)!;
    const slots = futureSlots(data);
    const nowState = classifyLight(slot);

    // 다음 골든/블루/박명 전환 찾기
    let next: { state: LightState; slot: PhotoSlot } | null = null;
    const targets: LightState[] = ['dawnGolden', 'duskGolden', 'dawnBlue', 'duskBlue', 'twilight'];
    for (const s of slots) {
        const st = classifyLight(s);
        if (st === nowState) continue;
        if (targets.includes(st)) { next = { state: st, slot: s }; break; }
    }

    const nowIsPeak = nowState === 'dawnGolden' || nowState === 'duskGolden' || nowState === 'dawnBlue' || nowState === 'duskBlue';
    let score = 30;
    if (nowIsPeak) score = 95;
    else if (next) {
        const deltaMs = new Date(next.slot.time).getTime() - Date.now();
        const deltaH = deltaMs / 3600000;
        if (deltaH < 1) score = 85;
        else if (deltaH < 3) score = 72;
        else if (deltaH < 8) score = 50;
        else score = 25;
    }

    return {
        id: 'light',
        icon: '☀️',
        name: t.object.light.name,
        grade: gradeFromScore(score),
        accent: COLORS.light.accent,
        gradient: COLORS.light.gradient,
        nowText: t.object.light.state[nowState],
        nowStateKey: nowState,
        nextText: next ? t.object.light.state[next.state] : undefined,
        nextWhenLabel: next ? formatRelativeTime(next.slot.time, data.location?.timezone, t, locale) : undefined,
        hintText: t.object.light.hint[nowIsPeak ? nowState : (next?.state ?? nowState)],
        sortScore: score,
    };
}

// ─── Sky Color extractor ────────────────────────────────────
function extractSkyColor(
    data: PhotoForecast,
    t: PhotoGuideI18n,
    locale: string,
): PhotoObject {
    const now = nowSlot(data)!;
    const slots = futureSlots(data);
    const nowCat = now.categories.skyColor;
    const nowActive = nowCat?.isActiveTime && (nowCat?.score ?? 0) >= 50;
    const nowPalette = nowCat?.palette;
    type State = keyof PhotoGuideI18n['object']['skyColor']['state'];
    const paletteToState = (p: string | undefined): State => {
        if (p === 'burning') return 'burning';
        if (p === 'vivid') return 'vivid';
        if (p === 'pastel') return 'pastel';
        if (p === 'muted') return 'muted';
        return 'none';
    };
    const nowState: State = nowActive ? paletteToState(nowPalette) : 'none';

    // 향후 24h 내 최고 피크
    let bestNext: PhotoSlot | null = null;
    let bestScore = -1;
    for (const s of slots) {
        const sc = s.categories.skyColor;
        if (!sc?.isActiveTime) continue;
        if ((sc.score ?? 0) > bestScore && (sc.score ?? 0) >= 40) {
            bestNext = s;
            bestScore = sc.score ?? 0;
        }
    }

    let nextState: State | undefined;
    let nextWhenLabel: string | undefined;
    let hintState: State = nowState;
    if (bestNext && (nowCat?.score ?? 0) < bestScore) {
        nextState = paletteToState(bestNext.categories.skyColor?.palette);
        nextWhenLabel = formatRelativeTime(bestNext.time, data.location?.timezone, t, locale);
        hintState = nextState;
    }

    // 점수: 현재 피크 > 가까운 피크 > 먼 피크
    let score = 20;
    if (nowActive) score = Math.max(score, nowCat.score ?? 40);
    if (bestNext) {
        const deltaH = (new Date(bestNext.time).getTime() - Date.now()) / 3600000;
        if (deltaH < 1) score = Math.max(score, bestScore);
        else if (deltaH < 6) score = Math.max(score, bestScore - 5);
        else if (deltaH < 24) score = Math.max(score, bestScore - 15);
    }

    // 방향 힌트
    const direction = bestNext?.categories.skyColor?.colorDirection ?? nowCat?.colorDirection;
    const dirLabel = direction ? (t.direction as Record<string, string>)[direction] : undefined;
    const hintExtra = dirLabel ? `${dirLabel}` : undefined;

    return {
        id: 'skyColor',
        icon: '🌇',
        name: t.object.skyColor.name,
        grade: gradeFromScore(score),
        accent: COLORS.skyColor.accent,
        gradient: COLORS.skyColor.gradient,
        nowText: t.object.skyColor.state[nowState],
        nowStateKey: nowState,
        nextText: nextState ? t.object.skyColor.state[nextState] : undefined,
        nextWhenLabel,
        hintText: t.object.skyColor.hint[hintState === 'none' ? 'none' : hintState],
        hintExtra,
        sortScore: score,
    };
}

// ─── Clouds extractor ───────────────────────────────────────
type CloudState = keyof PhotoGuideI18n['object']['clouds']['state'];

function classifyClouds(slot: PhotoSlot): CloudState {
    const total = slot.weather.cloudCoverTotal ?? 0;
    const low = slot.weather.cloudCoverLow ?? 0;
    if (total < 15) return 'clear';
    if (total > 90 && low > 60) return 'flat';
    if (total > 75) return 'overcast';
    if (total >= 25 && total <= 75) {
        const high = slot.weather.cloudCoverHigh ?? 0;
        const mid = slot.weather.cloudCoverMid ?? 0;
        return (high + mid) > low ? 'dramatic' : 'partly';
    }
    return 'partly';
}

function extractClouds(
    data: PhotoForecast,
    t: PhotoGuideI18n,
    locale: string,
): PhotoObject {
    const now = nowSlot(data)!;
    const slots = futureSlots(data);
    const nowState = classifyClouds(now);
    const nowTotal = now.weather.cloudCoverTotal ?? 0;

    // 다음 의미 있는 상태 변화
    let next: PhotoSlot | null = null;
    let nextState: CloudState | null = null;
    for (const s of slots) {
        const st = classifyClouds(s);
        if (st !== nowState && (st === 'dramatic' || st === 'clear' || st === 'flat')) {
            next = s;
            nextState = st;
            break;
        }
    }

    let score = 20;
    if (nowState === 'dramatic') score = 75;
    else if (nowState === 'partly') score = 55;
    else if (nowState === 'clear') score = 40;
    else if (nowState === 'overcast') score = 30;
    else score = 15;

    if (next && nextState === 'dramatic') {
        score = Math.max(score, 60);
    }

    return {
        id: 'clouds',
        icon: '☁️',
        name: t.object.clouds.name,
        grade: gradeFromScore(score),
        accent: COLORS.clouds.accent,
        gradient: COLORS.clouds.gradient,
        nowText: t.object.clouds.state[nowState],
        nowStateKey: nowState,
        nowValue: `${Math.round(nowTotal)}%`,
        nextText: nextState ? t.object.clouds.state[nextState] : undefined,
        nextWhenLabel: next ? formatRelativeTime(next.time, data.location?.timezone, t, locale) : undefined,
        hintText: t.object.clouds.hint[nowState],
        sortScore: score,
    };
}

// ─── Fog extractor ──────────────────────────────────────────
type FogState = keyof PhotoGuideI18n['object']['fog']['state'];

function fogTypeToState(ft: string | null | undefined): FogState {
    if (ft === 'radiation') return 'radiation';
    if (ft === 'advection') return 'advection';
    if (ft === 'valley') return 'valley';
    if (ft === 'upslope') return 'upslope';
    return 'none';
}

function extractFog(
    data: PhotoForecast,
    t: PhotoGuideI18n,
    locale: string,
): PhotoObject {
    const now = nowSlot(data)!;
    const slots = futureSlots(data);
    const nowScore = now.categories.fogSubject?.score ?? 0;
    const nowIsFog = nowScore >= 50;
    const nowState: FogState = nowIsFog ? fogTypeToState(now.categories.fogSubject?.fogType) : 'none';

    // 48h 내 최고 피크
    let bestNext: PhotoSlot | null = null;
    let bestScore = -1;
    for (const s of slots) {
        const sc = s.categories.fogSubject?.score ?? 0;
        if (sc > bestScore && sc >= 50) {
            bestNext = s;
            bestScore = sc;
        }
    }

    let nextState: FogState | undefined;
    let nextWhenLabel: string | undefined;
    if (bestNext && bestScore > nowScore + 5) {
        nextState = fogTypeToState(bestNext.categories.fogSubject?.fogType);
        nextWhenLabel = formatRelativeTime(bestNext.time, data.location?.timezone, t, locale);
    }

    let score = 15;
    if (nowIsFog) score = Math.max(score, nowScore);
    if (bestNext) {
        const deltaH = (new Date(bestNext.time).getTime() - Date.now()) / 3600000;
        if (deltaH < 3) score = Math.max(score, bestScore - 3);
        else if (deltaH < 12) score = Math.max(score, bestScore - 12);
        else if (deltaH < 48) score = Math.max(score, bestScore - 25);
    }

    const hintState: FogState = nextState ?? nowState;

    return {
        id: 'fog',
        icon: '🌫',
        name: t.object.fog.name,
        grade: gradeFromScore(score),
        accent: COLORS.fog.accent,
        gradient: COLORS.fog.gradient,
        nowText: t.object.fog.state[nowState],
        nextText: nextState ? t.object.fog.state[nextState] : undefined,
        nextWhenLabel,
        hintText: t.object.fog.hint[hintState],
        sortScore: score,
    };
}

// ─── Wind extractor ─────────────────────────────────────────
type WindState = keyof PhotoGuideI18n['object']['wind']['state'];

function classifyWind(slot: PhotoSlot): { state: WindState; speed: number; gust: number } {
    const speed = slot.weather.windSpeed ?? 0;
    const gust = slot.weather.windGusts ?? 0;
    if (gust > 15) return { state: 'gust', speed, gust };
    if (speed > 10) return { state: 'strong', speed, gust };
    if (speed > 5) return { state: 'moderate', speed, gust };
    if (speed > 2) return { state: 'breeze', speed, gust };
    return { state: 'calm', speed, gust };
}

function extractWind(
    data: PhotoForecast,
    t: PhotoGuideI18n,
    locale: string,
): PhotoObject {
    const now = nowSlot(data)!;
    const slots = futureSlots(data);
    const { state: nowState, speed: nowSpeed } = classifyWind(now);

    // 다음 의미 있는 상태 전환 (특히 calm → strong 또는 반대)
    let next: PhotoSlot | null = null;
    let nextState: WindState | null = null;
    for (const s of slots) {
        const { state } = classifyWind(s);
        if (state !== nowState && (state === 'calm' || state === 'strong' || state === 'gust')) {
            next = s;
            nextState = state;
            break;
        }
    }

    let score = 40;
    if (nowState === 'calm') score = 75;
    else if (nowState === 'breeze') score = 55;
    else if (nowState === 'moderate') score = 30;
    else score = 20; // strong/gust

    return {
        id: 'wind',
        icon: '💨',
        name: t.object.wind.name,
        grade: gradeFromScore(score),
        accent: COLORS.wind.accent,
        gradient: COLORS.wind.gradient,
        nowText: t.object.wind.state[nowState],
        nowValue: `${nowSpeed.toFixed(1)} m/s`,
        nextText: nextState ? t.object.wind.state[nextState] : undefined,
        nextWhenLabel: next ? formatRelativeTime(next.time, data.location?.timezone, t, locale) : undefined,
        hintText: t.object.wind.hint[nowState],
        sortScore: score,
    };
}

// ─── Moon extractor ─────────────────────────────────────────
type MoonState = keyof PhotoGuideI18n['object']['moon']['state'];

function classifyMoon(fraction: number): MoonState {
    if (fraction < 0.08) return 'new';
    if (fraction < 0.35) return 'crescent';
    if (fraction < 0.65) return 'halfMoon';
    if (fraction < 0.95) return 'gibbous';
    return 'full';
}

function extractMoon(
    data: PhotoForecast,
    t: PhotoGuideI18n,
    _locale: string,
): PhotoObject {
    const now = nowSlot(data)!;
    const fraction = now.moon?.moonFraction ?? 0;
    const nowState = classifyMoon(fraction);

    // ≤7일 내 달 관련 phenomena
    const nearMoonTypes = new Set(['blood-moon', 'supermoon', 'lunar-eclipse-total', 'lunar-eclipse-partial', 'lunar-eclipse-penumbral']);
    const nearEvents = (data.phenomena || []).filter(
        (p) => nearMoonTypes.has(p.type) && p.dDay >= 0 && p.dDay <= 7,
    );
    const meteorShowers = (data.phenomena || []).filter(
        (p) => p.type === 'meteor-shower' && p.dDay >= 0 && p.dDay <= 7,
    );

    let score = 25;
    let nextText: string | undefined;
    let nextWhenLabel: string | undefined;
    let hintText = t.object.moon.hint[nowState];
    let hintExtra: string | undefined;

    if (nearEvents.length > 0) {
        const ev = nearEvents[0];
        const label = (t.phenomena.type as Record<string, string>)[ev.type] ?? ev.type;
        nextText = label;
        nextWhenLabel = t.phenomena.dDay(ev.dDay);
        score = 92; // S급
        hintText = label;
        hintExtra = ev.direction ? (t.direction as Record<string, string>)[ev.direction] : undefined;
    } else if (meteorShowers.length > 0 && fraction < 0.4) {
        const ev = meteorShowers[0];
        const label = (t.phenomena.type as Record<string, string>)[ev.type] ?? ev.type;
        nextText = label;
        nextWhenLabel = t.phenomena.dDay(ev.dDay);
        score = 78;
    } else if (fraction < 0.25) {
        score = 55; // 별 촬영에 유리
    }

    return {
        id: 'moon',
        icon: '🌙',
        name: t.object.moon.name,
        grade: gradeFromScore(score),
        accent: COLORS.moon.accent,
        gradient: COLORS.moon.gradient,
        nowText: t.object.moon.state[nowState],
        nowValue: `${Math.round(fraction * 100)}%`,
        nextText,
        nextWhenLabel,
        hintText,
        hintExtra,
        sortScore: score,
    };
}

// ─── Visibility extractor ───────────────────────────────────
type VisState = keyof PhotoGuideI18n['object']['visibility']['state'];

function classifyVisibility(m: number): VisState {
    if (m >= 18000) return 'excellent';
    if (m >= 12000) return 'good';
    if (m >= 6000) return 'moderate';
    return 'poor';
}

function extractVisibility(
    data: PhotoForecast,
    t: PhotoGuideI18n,
    locale: string,
): PhotoObject {
    const now = nowSlot(data)!;
    const slots = futureSlots(data);
    const rawVis = now.weather.visibility;
    const hasData = typeof rawVis === 'number' && rawVis > 0;
    const nowVis = hasData ? rawVis : 0;
    const nowState = hasData ? classifyVisibility(nowVis) : 'good';

    // 향후 상승 전환
    let next: PhotoSlot | null = null;
    let nextState: VisState | null = null;
    for (const s of slots) {
        const v = s.weather.visibility ?? 0;
        const st = classifyVisibility(v);
        if (st !== nowState && v > nowVis + 4000) {
            next = s;
            nextState = st;
            break;
        }
    }

    let score = 30;
    if (!hasData) score = 20;
    else if (nowState === 'excellent') score = 70;
    else if (nowState === 'good') score = 55;
    else if (nowState === 'moderate') score = 35;
    else score = 15;

    return {
        id: 'visibility',
        icon: '👀',
        name: t.object.visibility.name,
        grade: gradeFromScore(score),
        accent: COLORS.visibility.accent,
        gradient: COLORS.visibility.gradient,
        nowText: t.object.visibility.state[nowState],
        nowValue: hasData ? (nowVis >= 1000 ? `${Math.round(nowVis / 1000)} km` : `${nowVis} m`) : undefined,
        nextText: nextState ? t.object.visibility.state[nextState] : undefined,
        nextWhenLabel: next ? formatRelativeTime(next.time, data.location?.timezone, t, locale) : undefined,
        hintText: t.object.visibility.hint[nowState],
        sortScore: score,
    };
}

// ─── Public: master extractor ───────────────────────────────
export function extractObjects(
    data: PhotoForecast,
    t: PhotoGuideI18n,
    locale: string,
): PhotoObject[] {
    if (!data.forecast || data.forecast.length === 0) return [];
    return [
        extractLight(data, t, locale),
        extractSkyColor(data, t, locale),
        extractClouds(data, t, locale),
        extractFog(data, t, locale),
        extractWind(data, t, locale),
        extractMoon(data, t, locale),
        extractVisibility(data, t, locale),
    ];
}

// ─── Hero pick ──────────────────────────────────────────────
export function pickHero(objects: PhotoObject[]): PhotoObject | null {
    if (objects.length === 0) return null;
    const sorted = [...objects].sort((a, b) => b.sortScore - a.sortScore);
    const top = sorted[0];
    if (!top || top.sortScore < 65) return null; // S/A 없음 → 빈 상태 HERO
    return top;
}

// ─── Warnings ───────────────────────────────────────────────
export function extractWarnings(
    data: PhotoForecast,
    t: PhotoGuideI18n,
): PhotoWarning[] {
    const slot = nowSlot(data);
    if (!slot) return [];
    const w = slot.weather;
    const warnings: PhotoWarning[] = [];

    if ((w.windGusts ?? 0) > 15) {
        warnings.push({ id: 'gust', text: t.object.warnings.gust });
    } else if ((w.windSpeed ?? 0) > 10) {
        warnings.push({ id: 'strongWind', text: t.object.warnings.strongWind });
    }

    if ((w.dewPointSpread ?? 99) < 1.5 && (w.relativeHumidity ?? 0) > 90) {
        warnings.push({ id: 'condensation', text: t.object.warnings.condensation });
    }

    if ((w.temp2m ?? 99) <= -5) {
        warnings.push({ id: 'cold', text: t.object.warnings.cold });
    }

    if ((w.uvIndex ?? 0) >= 8) {
        warnings.push({ id: 'uv', text: t.object.warnings.uv });
    }

    return warnings;
}

// ─── Far phenomena (≥8일) ───────────────────────────────────
export function farPhenomena(items: PhenomenaCalendarEntry[]): PhenomenaCalendarEntry[] {
    return (items || []).filter((p) => p.dDay >= 8);
}

// ─── v5.2 Scenario builder ─────────────────────────────────
export type ScenarioId =
    | 'goldenDrama'
    | 'explosiveSunset'
    | 'starTrail'
    | 'morningFog'
    | 'reflection'
    | 'softPortrait'
    | 'cityNight'
    | 'cloudTrail'
    | 'stayIndoor';

export interface Scenario {
    id: ScenarioId;
    score: number;
    grade: Grade;
    /** Which objects contribute to this scenario */
    relatedObjects: ObjectId[];
    /** Time window if available (ISO strings) */
    timeWindow?: { start: string; end: string; remainingMin?: number };
    /** Inline warnings for this scenario */
    warnings: PhotoWarning[];
}

/**
 * Combine 7 photo objects into actionable shooting scenarios.
 * Returns 2-4 relevant scenarios sorted by score.
 */
export function buildScenarios(
    objects: PhotoObject[],
    data: PhotoForecast,
    warnings: PhotoWarning[],
): Scenario[] {
    const objMap = new Map(objects.map((o) => [o.id, o]));
    const get = (id: ObjectId) => objMap.get(id);

    const light = get('light');
    const skyColor = get('skyColor');
    const clouds = get('clouds');
    const fog = get('fog');
    const wind = get('wind');
    const moon = get('moon');
    const visibility = get('visibility');

    if (!light || !skyColor || !clouds || !fog || !wind || !moon || !visibility) return [];

    const now = nowSlot(data);
    const scenarios: Scenario[] = [];

    // Helper: get twilight time windows from data
    const todayTwilight = data.twilight?.[0];

    // 판정은 번역 문구(nowText)가 아니라 언어 무관 상태 키(nowStateKey)로 한다.
    // (옛 코드는 nowText.includes('golden') 식이라 영문 'Night'/'Burning'/'Dramatic'처럼
    //  대문자로 시작하는 표시 문구에서 매칭이 전부 실패했다.)

    // 1. Golden Drama — golden hour + dramatic clouds
    const isGoldenNow = light.nowStateKey === 'dawnGolden' || light.nowStateKey === 'duskGolden';
    const isDramatic = clouds.sortScore >= 55;
    if (isGoldenNow && isDramatic) {
        const window = todayTwilight?.dusk?.goldenHour ?? todayTwilight?.dawn?.goldenHour;
        scenarios.push({
            id: 'goldenDrama',
            score: Math.round((light.sortScore + clouds.sortScore) / 2 + 10),
            grade: gradeFromScore(Math.round((light.sortScore + clouds.sortScore) / 2 + 10)),
            relatedObjects: ['light', 'clouds', 'wind'],
            timeWindow: window ? { ...window, remainingMin: timeRemainingMin(window.end) } : undefined,
            warnings: warnings.filter((w) => w.id === 'strongWind' || w.id === 'gust'),
        });
    }

    // 2. Explosive Sunset — skyColor burning
    // (옛 코드 `A >= 70 && B || C`는 연산자 우선순위상 `(A&&B)||C`로 묶여,
    //  C가 참이면 점수 70 미만이어도 통과하는 버그가 있었다. 키 기준으로 한 줄로 정리.)
    if (skyColor.sortScore >= 70 && skyColor.nowStateKey === 'burning') {
        const window = todayTwilight?.dusk?.goldenHour;
        scenarios.push({
            id: 'explosiveSunset',
            score: skyColor.sortScore + 5,
            grade: gradeFromScore(skyColor.sortScore + 5),
            relatedObjects: ['skyColor', 'light', 'clouds'],
            timeWindow: window ? { ...window, remainingMin: timeRemainingMin(window.end) } : undefined,
            warnings: [],
        });
    }

    // 3. Star Trail — night + dark moon + clear sky
    const isNight = now?.solar?.isNight || light.nowStateKey === 'night';
    const moonDark = moon.sortScore >= 40 && (moon.nowValue ? parseInt(moon.nowValue) < 40 : true);
    const skyClear = clouds.sortScore <= 45;
    if (isNight && moonDark && skyClear) {
        // 점수를 실제 moon/clouds sortScore에서 계산하고 등급도 그 점수로 매긴다.
        // (과거엔 grade를 85로 하드코딩해 점수와 불일치 — 가짜 등급)
        const starTrailScore = Math.round((moon.sortScore + (100 - (clouds.sortScore / 75 * 100))) / 2 + 15);
        scenarios.push({
            id: 'starTrail',
            score: starTrailScore,
            grade: gradeFromScore(starTrailScore),
            relatedObjects: ['moon', 'clouds', 'wind', 'visibility'],
            warnings: warnings.filter((w) => w.id === 'condensation' || w.id === 'cold'),
        });
    }

    // 4. Morning Fog
    if (fog.sortScore >= 50) {
        scenarios.push({
            id: 'morningFog',
            score: fog.sortScore,
            grade: gradeFromScore(fog.sortScore),
            relatedObjects: ['fog', 'light', 'visibility'],
            warnings: warnings.filter((w) => w.id === 'condensation'),
        });
    }

    // 5. Mirror Reflection — calm wind + good visibility + clear/partly
    const isCalm = wind.sortScore >= 60;
    const decentVis = visibility.sortScore >= 45;
    const notOvercast = clouds.sortScore <= 60;
    if (isCalm && decentVis && notOvercast) {
        scenarios.push({
            id: 'reflection',
            score: Math.round((wind.sortScore + visibility.sortScore) / 2),
            grade: gradeFromScore(Math.round((wind.sortScore + visibility.sortScore) / 2)),
            relatedObjects: ['wind', 'visibility', 'clouds'],
            warnings: [],
        });
    }

    // 6. Soft Portrait — overcast/flat + daytime
    const isOvercast = clouds.nowStateKey === 'overcast' || clouds.nowStateKey === 'flat';
    const isDay = now?.solar?.isDay || light.nowStateKey === 'dayNormal' || light.nowStateKey === 'dayHarsh';
    if (isOvercast && isDay) {
        // 흐린 날 부드러운 광질 포트레이트. 과거엔 조건 무관 65 고정(가짜)이었다.
        // 실측 기반(잔잔한 바람 + 시정)으로 점수를 내고 등급도 그 점수로 매긴다.
        const softPortraitScore = Math.round((wind.sortScore + visibility.sortScore) / 2);
        scenarios.push({
            id: 'softPortrait',
            score: softPortraitScore,
            grade: gradeFromScore(softPortraitScore),
            relatedObjects: ['clouds', 'light', 'wind'],
            warnings: [],
        });
    }

    // 7. City Night — blue hour
    const isBlueHour = light.nowStateKey === 'dawnBlue' || light.nowStateKey === 'duskBlue';
    if (isBlueHour) {
        const window = todayTwilight?.dusk?.blueHour ?? todayTwilight?.dawn?.blueHour;
        scenarios.push({
            id: 'cityNight',
            score: light.sortScore,
            grade: gradeFromScore(light.sortScore),
            relatedObjects: ['light', 'wind', 'visibility'],
            timeWindow: window ? { ...window, remainingMin: timeRemainingMin(window.end) } : undefined,
            warnings: [],
        });
    }

    // 8. Cloud Trail — breeze/moderate wind + partly/dramatic clouds
    const windState = now?.weather?.windSpeed ?? 0;
    const hasMovingClouds = clouds.nowStateKey === 'dramatic' || clouds.nowStateKey === 'partly';
    if (windState >= 3 && windState <= 12 && hasMovingClouds) {
        scenarios.push({
            id: 'cloudTrail',
            score: Math.round((clouds.sortScore + 50) / 2 + 10),
            grade: gradeFromScore(Math.round((clouds.sortScore + 50) / 2 + 10)),
            relatedObjects: ['clouds', 'wind'],
            warnings: warnings.filter((w) => w.id === 'gust'),
        });
    }

    // Sort by score, take top 4
    scenarios.sort((a, b) => b.score - a.score);
    const result = scenarios.slice(0, 4);

    // If nothing scored above 40, add stayIndoor
    if (result.length === 0 || (result.length > 0 && result[0].score < 40)) {
        result.push({
            id: 'stayIndoor',
            score: 10,
            grade: 'C',
            relatedObjects: [],
            warnings: [],
        });
    }

    return result;
}

/**
 * Determine the shooting verdict text key based on top scenarios.
 */
export function getVerdictKey(
    scenarios: Scenario[],
    _objects: PhotoObject[],
): string {
    if (scenarios.length === 0 || scenarios[0].id === 'stayIndoor') {
        return 'average';
    }
    const top = scenarios[0];
    switch (top.id) {
        case 'goldenDrama': return top.score >= 85 ? 'landscapeBest' : 'landscapeGood';
        case 'explosiveSunset': return 'explosiveSunset';
        case 'starTrail': return 'astroGreat';
        case 'morningFog': return 'fogMagic';
        case 'reflection': return 'reflectionTime';
        case 'softPortrait': return 'softLight';
        case 'cityNight': return 'cityNight';
        case 'cloudTrail': return 'landscapeGood';
        default: return 'landscapeGood';
    }
}

/**
 * Get "good reason" tags from high-scoring objects (S/A grade).
 */
export function getGoodReasonTags(objects: PhotoObject[]): PhotoObject[] {
    return objects.filter((o) => o.grade === 'S' || o.grade === 'A');
}

/**
 * Get "bad reason" tags from low-scoring objects with problems.
 */
export function getBadReasonTags(objects: PhotoObject[]): PhotoObject[] {
    return objects.filter((o) => o.grade === 'C' && o.sortScore < 25);
}

function timeRemainingMin(endIso: string): number {
    const end = new Date(endIso).getTime();
    if (isNaN(end)) return 0;
    return Math.max(0, Math.round((end - Date.now()) / 60000));
}
