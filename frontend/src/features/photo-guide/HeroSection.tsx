/**
 * v5.2 Photo Guide — Verdict Hero Card
 *
 * 종합 판정: "지금은 _____ 찍기 좋은 시간입니다"
 * + 좋은 이유 태그 (S/A 오브제)
 * + 나쁜 조건 태그 (C 등급, 낮은 점수)
 * + 구체적 액션 힌트
 */
import React from 'react';
import { Camera } from 'lucide-react';
import type { PhotoObject } from './objectExtractor';
import { usePhotoGuideI18n } from './i18n';

interface Props {
    verdictKey: string;
    goodTags: PhotoObject[];
    badTags: PhotoObject[];
    topHint?: string;
    fallbackNextRel?: string;
}

const VERDICT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    landscapeBest:    { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)', text: '#6ee7b7' },
    landscapeGood:    { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.30)', text: '#93c5fd' },
    astroGreat:       { bg: 'rgba(192,132,252,0.15)', border: 'rgba(192,132,252,0.35)', text: '#c4b5fd' },
    fogMagic:         { bg: 'rgba(110,231,183,0.12)', border: 'rgba(110,231,183,0.30)', text: '#6ee7b7' },
    cityNight:        { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.30)', text: '#7dd3fc' },
    softLight:        { bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.25)', text: '#fcd34d' },
    reflectionTime:   { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.30)', text: '#93c5fd' },
    explosiveSunset:  { bg: 'rgba(249,115,22,0.18)', border: 'rgba(249,115,22,0.40)', text: '#fdba74' },
    average:          { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
    indoor:           { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.20)', text: '#94a3b8' },
};

const HeroSection: React.FC<Props> = ({
    verdictKey,
    goodTags,
    badTags,
    topHint,
    fallbackNextRel,
}) => {
    const t = usePhotoGuideI18n();
    const verdict = (t.verdict as Record<string, unknown>)[verdictKey];
    const verdictText = typeof verdict === 'string' ? verdict : t.verdict.average;
    const colors = VERDICT_COLORS[verdictKey] || VERDICT_COLORS.average;
    const isGood = verdictKey !== 'average' && verdictKey !== 'indoor';

    return (
        <div
            className="rounded-2xl p-5 space-y-3 relative overflow-hidden"
            style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                boxShadow: `0 0 0 1px ${colors.border.replace(')', ',0.1)')}, 0 8px 32px rgba(0,0,0,0.15)`,
            }}
        >
            {/* Verdict header */}
            <div className="flex items-start gap-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${colors.border}`, color: '#fff' }}
                >
                    <Camera className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div
                        className="text-lg font-bold leading-tight"
                        style={{ color: colors.text }}
                    >
                        {verdictText}
                    </div>
                </div>
            </div>

            {/* Good reason tags */}
            {goodTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {goodTags.map((obj) => (
                        <span
                            key={obj.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                            style={{
                                background: `${obj.accent}18`,
                                border: `1px solid ${obj.accent}35`,
                                color: obj.accent,
                            }}
                        >
                            <span aria-hidden="true">{obj.icon}</span>
                            {obj.nowText}
                            {obj.nowValue && (
                                <span className="opacity-70 font-data">{obj.nowValue}</span>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {/* Bad reason tags */}
            {badTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {badTags.map((obj) => (
                        <span
                            key={obj.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                            style={{
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.25)',
                                color: '#fca5a5',
                            }}
                        >
                            <span aria-hidden="true">{obj.icon}</span>
                            {obj.nowText}
                            {obj.nowValue && (
                                <span className="opacity-70 font-data">{obj.nowValue}</span>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {/* Top hint */}
            {topHint && isGood && (
                <div className="pt-2 border-t border-white/10">
                    <div className="text-sm text-[var(--text-primary)] leading-snug">
                        <span className="mr-1.5" aria-hidden="true">💡</span>
                        {topHint}
                    </div>
                </div>
            )}

            {/* Empty state: next chance */}
            {!isGood && (
                <div className="pt-2 border-t border-white/10 space-y-1">
                    {fallbackNextRel && (
                        <div className="text-xs font-semibold" style={{ color: '#fbbf24' }}>
                            {t.verdict.nextChance(fallbackNextRel)}
                        </div>
                    )}
                    <div className="text-xs text-[var(--text-tertiary)]">
                        💡 {t.verdict.fallbackTip}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HeroSection;
