/**
 * v5.0 Photo Guide — i18n accessor (feature-local)
 *
 * 기존 src/hooks/useI18n.ts 와 동일한 네비게이터 기반 언어 감지를 사용하되,
 * photo-guide 기능 전용 번역만 제공.
 *
 * ja/zh 는 Phase D 에서 추가 — 현재는 en 폴백.
 */
import en from './en';
import ko from './ko';

type Lang = 'ko' | 'ja' | 'zh' | 'en';

function detectLang(): Lang {
    const lang = (navigator.language || 'en').toLowerCase();
    if (lang.startsWith('ko')) return 'ko';
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('zh')) return 'zh';
    return 'en';
}

const table = { en, ko, ja: en, zh: en } as const;

export function usePhotoGuideI18n() {
    const lang = detectLang();
    return table[lang];
}

export function detectPhotoGuideLang(): Lang {
    return detectLang();
}

export type { PhotoGuideI18n } from './en';
