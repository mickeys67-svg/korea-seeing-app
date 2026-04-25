/**
 * v5.1 Photo Guide — Moment extractor
 *
 * forecast 슬롯 리스트에서 "촬영 순간(Moment)"을 추출한다.
 * 각 Moment 는 감정 카피 + 이모지 + 시간으로 구성되어 UI 에서 직접 렌더.
 *
 * 원칙:
 * 1. 48시간 윈도우
 * 2. 슬롯별로 가장 강한 카테고리를 선정 (임계값 초과 시)
 * 3. 같은 카테고리는 4시간 쿨다운 (중복 제거)
 * 4. 시간순 정렬, 최대 8개
 */
import type { PhotoForecast, PhotoSlot, Palette } from './types';
import type { PhotoGuideI18n } from './i18n';

export type MomentCategory =
    | 'skyColor'
    | 'longExposure'
    | 'fogSubject'
    | 'general';

export interface Moment {
    time: string;
    category: MomentCategory;
    slot: PhotoSlot;
    score: number;

    // Pre-computed display hints
    emoji: string;
    titleKey: keyof PhotoGuideI18n['momentCopy'];
    palette?: Palette;
    fogType?: string | null;
    direction?: string | null;
}

const CATEGORY_EMOJI: Record<MomentCategory, string> = {
    skyColor: '🌇',
    fogSubject: '🌫',
    longExposure: '⏱',
    general: '📷',
};

interface ThresholdSpec {
    cat: MomentCategory;
    score: number;
    threshold: number;
}

export function extractMoments(data: PhotoForecast): Moment[] {
    const slots = data.forecast || [];
    if (slots.length === 0) return [];

    const now = Date.now();
    const horizon = now + 48 * 3600 * 1000;
    const GAP = 3 * 3600 * 1000;   // 3h cooldown per category

    const moments: Moment[] = [];
    const lastShownByCat = new Map<MomentCategory, number>();

    for (const slot of slots) {
        const t = new Date(slot.time).getTime();
        if (isNaN(t)) continue;
        if (t < now - 15 * 60 * 1000) continue;  // skip past (15min grace)
        if (t > horizon) break;

        const sky = slot.categories.skyColor;
        const fog = slot.categories.fogSubject;
        const longExp = slot.categories.longExposure;
        const general = slot.categories.general;

        const candidates: ThresholdSpec[] = [
            { cat: 'skyColor',     score: sky?.score     ?? 0, threshold: 60 },
            { cat: 'fogSubject',   score: fog?.score     ?? 0, threshold: 55 },
            { cat: 'longExposure', score: longExp?.score ?? 0, threshold: 70 },
            { cat: 'general',      score: general?.score ?? 0, threshold: 78 },
        ];

        candidates.sort((a, b) => b.score - a.score);
        const top = candidates[0];
        if (top.score < top.threshold) continue;

        const last = lastShownByCat.get(top.cat);
        if (last !== undefined && t - last < GAP) continue;
        lastShownByCat.set(top.cat, t);

        moments.push({
            time: slot.time,
            category: top.cat,
            slot,
            score: top.score,
            emoji: CATEGORY_EMOJI[top.cat],
            titleKey: pickTitleKey(top.cat, slot),
            palette: sky?.palette,
            fogType: fog?.fogType,
            direction: sky?.colorDirection ?? null,
        });
    }

    moments.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return moments.slice(0, 8);
}

function pickTitleKey(
    cat: MomentCategory,
    slot: PhotoSlot,
): keyof PhotoGuideI18n['momentCopy'] {
    if (cat === 'skyColor') {
        const p = slot.categories.skyColor?.palette;
        if (p === 'burning') return 'skyColorBurning';
        if (p === 'vivid')   return 'skyColorVivid';
        if (p === 'pastel')  return 'skyColorPastel';
        if (p === 'muted')   return 'skyColorMuted';
        return 'skyColorGeneric';
    }
    if (cat === 'fogSubject') {
        const ft = slot.categories.fogSubject?.fogType;
        if (ft === 'radiation') return 'fogRadiation';
        if (ft === 'advection') return 'fogAdvection';
        if (ft === 'valley')    return 'fogValley';
        if (ft === 'upslope')   return 'fogUpslope';
        return 'fogGeneric';
    }
    if (cat === 'longExposure') {
        const subjects = slot.categories.longExposure?.bestSubjects || [];
        const ids = new Set(subjects.map((s) => s.id));
        if (ids.has('star-trail'))  return 'longExposureStar';
        if (ids.has('cloud-trail')) return 'longExposureCloud';
        if (ids.has('water-silk') || ids.has('ocean-long-exp')) return 'longExposureWater';
        return 'longExposure';
    }
    // general
    const cloudTotal = slot.weather.cloudCoverTotal ?? 0;
    const vis = slot.weather.visibility ?? 0;
    if (cloudTotal > 30 && cloudTotal < 70) return 'generalDramatic';
    if (vis > 18000) return 'generalClarity';
    return 'generalGreat';
}

/**
 * Format a slot time as a human-friendly relative label.
 * Uses i18n functions for localization.
 */
export function formatRelativeTime(
    isoTime: string,
    tz: string | undefined,
    t: PhotoGuideI18n,
    locale: string,
): string {
    const then = new Date(isoTime).getTime();
    if (isNaN(then)) return '';
    const now = Date.now();
    const diffMs = then - now;
    const diffMin = Math.round(diffMs / 60000);

    if (diffMin < 5)  return t.moment.now;
    if (diffMin < 60) return t.moment.inMinutes(diffMin);
    if (diffMin < 80) return t.moment.inHour;

    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 8) return t.moment.inHours(diffHours);

    // ≥ 8 hours: absolute time. Decide today/tomorrow prefix.
    try {
        const target = new Date(then);
        const nowDate = new Date(now);
        const tzKey = tz || undefined;

        const ymd = (d: Date) =>
            new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tzKey }).format(d);

        const targetYmd = ymd(target);
        const nowYmd = ymd(nowDate);
        const tomorrowYmd = ymd(new Date(now + 24 * 3600 * 1000));

        const timePart = new Intl.DateTimeFormat(locale, {
            hour: '2-digit', minute: '2-digit', timeZone: tzKey,
        }).format(target);

        if (targetYmd === nowYmd) return `${t.moment.today} ${timePart}`;
        if (targetYmd === tomorrowYmd) return `${t.moment.tomorrow} ${timePart}`;

        return new Intl.DateTimeFormat(locale, {
            weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: tzKey,
        }).format(target);
    } catch {
        return isoTime.slice(11, 16);
    }
}
