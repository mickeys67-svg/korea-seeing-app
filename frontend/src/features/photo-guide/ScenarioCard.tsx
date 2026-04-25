/**
 * v5.2 Photo Guide — Scenario Card
 *
 * 촬영 시나리오 카드: 날씨 조합 → "뭘 찍을 수 있는지" 구체적 제안
 * - 시나리오 이름 + 등급
 * - 왜 지금 좋은지 한 줄 설명
 * - 촬영 팁 3개
 * - 시간 윈도우 (있을 때만)
 * - 관련 조건 태그
 * - 인라인 경고
 */
import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import type { Scenario, PhotoObject, Grade } from './objectExtractor';
import { usePhotoGuideI18n } from './i18n';

interface Props {
    scenario: Scenario;
    objects: PhotoObject[];
}

const GRADE_BADGE: Record<Grade, { bg: string; text: string }> = {
    S: { bg: '#ef4444', text: '#fff' },
    A: { bg: '#f59e0b', text: '#fff' },
    B: { bg: '#64748b', text: '#e2e8f0' },
    C: { bg: '#334155', text: '#94a3b8' },
};

const ScenarioCard: React.FC<Props> = ({ scenario, objects }) => {
    const t = usePhotoGuideI18n();
    const scenarioI18n = (t.scenario as Record<string, { name: string; icon: string; desc: string; tips: string[] }>)[scenario.id];
    if (!scenarioI18n) return null;

    const badge = GRADE_BADGE[scenario.grade];
    const relatedObjs = objects.filter((o) => scenario.relatedObjects.includes(o.id));

    return (
        <div
            className="glass-card-inner rounded-xl overflow-hidden"
            style={{ borderLeft: `3px solid ${relatedObjs[0]?.accent ?? '#64748b'}` }}
        >
            <div className="px-4 py-3 space-y-2.5">
                {/* Header: icon + name + grade */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl leading-none" aria-hidden="true">
                            {scenarioI18n.icon}
                        </span>
                        <span className="text-base font-bold text-[var(--text-bright)]">
                            {scenarioI18n.name}
                        </span>
                    </div>
                    <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded leading-none"
                        style={{ background: badge.bg, color: badge.text }}
                    >
                        {scenario.grade}
                    </span>
                </div>

                {/* Description: why this is good now */}
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {scenarioI18n.desc}
                </p>

                {/* Tips */}
                <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
                        📍 {t.object.labelHint}
                    </div>
                    <ul className="space-y-0.5">
                        {scenarioI18n.tips.map((tip, i) => (
                            <li
                                key={i}
                                className="text-xs text-[var(--text-primary)] leading-relaxed pl-3 relative"
                            >
                                <span className="absolute left-0 text-[var(--text-tertiary)]">•</span>
                                {tip}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Time window */}
                {scenario.timeWindow && scenario.timeWindow.remainingMin != null && scenario.timeWindow.remainingMin > 0 && (
                    <div
                        className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5"
                        style={{
                            background: 'rgba(251,191,36,0.08)',
                            border: '1px solid rgba(251,191,36,0.20)',
                            color: '#fbbf24',
                        }}
                    >
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>
                            {formatTimeRange(scenario.timeWindow.start, scenario.timeWindow.end)}
                            {' '}
                            ({scenario.timeWindow.remainingMin}{t.moment.inMinutes(scenario.timeWindow.remainingMin).replace(/\d+/, '').trim()})
                        </span>
                    </div>
                )}

                {/* Related condition tags */}
                {relatedObjs.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                        {relatedObjs.map((obj) => (
                            <span
                                key={obj.id}
                                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded"
                                style={{
                                    background: `${obj.accent}12`,
                                    color: obj.accent,
                                }}
                            >
                                {obj.icon} {obj.nowText}
                            </span>
                        ))}
                    </div>
                )}

                {/* Inline warnings */}
                {scenario.warnings.length > 0 && (
                    <div className="space-y-1">
                        {scenario.warnings.map((w) => (
                            <div
                                key={w.id}
                                className="flex items-center gap-1.5 text-[11px] rounded px-2 py-1"
                                style={{
                                    background: 'rgba(239,68,68,0.06)',
                                    border: '1px solid rgba(239,68,68,0.18)',
                                    color: '#fca5a5',
                                }}
                            >
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {w.text}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

function formatTimeRange(startIso: string, endIso: string): string {
    try {
        const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit', hour12: false,
        });
        return `${fmt(startIso)} ~ ${fmt(endIso)}`;
    } catch {
        return '';
    }
}

export default ScenarioCard;
