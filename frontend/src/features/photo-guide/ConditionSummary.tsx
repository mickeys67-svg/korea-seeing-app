/**
 * v5.2 Photo Guide — Condition Summary
 *
 * 7개 오브제를 컬러 바 한 줄씩으로 압축 표시.
 * 기본 접혀 있고, 자세히 탭하면 펼쳐짐.
 * 각 행 탭하면 기존 HINT 정보를 인라인으로 표시.
 */
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PhotoObject } from './objectExtractor';
import { usePhotoGuideI18n } from './i18n';

interface Props {
    objects: PhotoObject[];
}

/**
 * Map object sortScore to a color for "good for photography" context.
 * Higher score = greener (better condition for photos).
 */
function scoreToColor(score: number): string {
    if (score >= 75) return '#10b981'; // green
    if (score >= 55) return '#60a5fa'; // blue
    if (score >= 40) return '#fbbf24'; // amber
    return '#ef4444'; // red
}

const ConditionSummary: React.FC<Props> = ({ objects }) => {
    const t = usePhotoGuideI18n();
    const [expanded, setExpanded] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    if (objects.length === 0) return null;

    return (
        <div className="glass-card-inner rounded-xl overflow-hidden">
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    {t.conditionSummary.heading}
                </span>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                        {expanded ? t.conditionSummary.hideDetail : t.conditionSummary.showDetail}
                    </span>
                    <ChevronDown
                        className="w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform"
                        style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
                    />
                </div>
            </button>

            {/* Mini bars (always visible) */}
            <div className="px-4 pb-3 space-y-0.5">
                {objects.map((obj) => {
                    const barWidth = Math.max(5, Math.min(100, obj.sortScore));
                    const color = scoreToColor(obj.sortScore);
                    const isSelected = expanded && selectedId === obj.id;

                    return (
                        <div key={obj.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!expanded) {
                                        setExpanded(true);
                                        setSelectedId(obj.id);
                                    } else {
                                        setSelectedId(isSelected ? null : obj.id);
                                    }
                                }}
                                className="w-full flex items-center gap-2 py-1 hover:bg-white/5 rounded transition-colors text-left"
                            >
                                {/* Icon */}
                                <span className="text-sm w-5 text-center shrink-0" aria-hidden="true">
                                    {obj.icon}
                                </span>

                                {/* Name */}
                                <span className="text-[11px] text-[var(--text-secondary)] w-12 shrink-0 truncate">
                                    {obj.name}
                                </span>

                                {/* Bar */}
                                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${barWidth}%`,
                                            background: color,
                                            boxShadow: `0 0 6px ${color}40`,
                                        }}
                                    />
                                </div>

                                {/* State label */}
                                <span className="text-[11px] text-[var(--text-primary)] w-24 text-right truncate">
                                    {obj.nowText}
                                </span>

                                {/* Value */}
                                {obj.nowValue && (
                                    <span className="text-[10px] font-data text-[var(--text-tertiary)] w-12 text-right shrink-0">
                                        {obj.nowValue}
                                    </span>
                                )}
                            </button>

                            {/* Expanded hint */}
                            {isSelected && (
                                <div className="ml-7 mr-2 mb-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                                    <div className="text-xs text-[var(--text-primary)] leading-relaxed">
                                        <span className="mr-1" aria-hidden="true">💡</span>
                                        {obj.hintText}
                                    </div>
                                    {obj.hintExtra && (
                                        <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 ml-5">
                                            {obj.hintExtra}
                                        </div>
                                    )}
                                    {obj.nextText && (
                                        <div className="text-[11px] text-[var(--text-secondary)] mt-1 ml-5">
                                            <span className="text-[var(--text-tertiary)]">NEXT:</span>{' '}
                                            {obj.nextText}
                                            {obj.nextWhenLabel && (
                                                <span className="ml-1 text-[var(--text-tertiary)]">
                                                    · {obj.nextWhenLabel}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ConditionSummary;
