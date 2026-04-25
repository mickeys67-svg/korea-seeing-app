/**
 * v5.2 Photo Guide — Upcoming Opportunities Timeline
 *
 * 7개 오브제의 NEXT 정보를 시간순으로 정렬하여 타임라인 표시.
 * 최대 5개, 가까운 기회가 위에.
 */
import React from 'react';
import { Clock } from 'lucide-react';
import type { PhotoObject } from './objectExtractor';
import { usePhotoGuideI18n } from './i18n';

interface Props {
    objects: PhotoObject[];
}

interface UpcomingItem {
    icon: string;
    accent: string;
    nextText: string;
    nextWhenLabel: string;
    hintText: string;
    /** Approximate ms from now for sorting */
    sortMs: number;
}

function estimateSortMs(whenLabel: string): number {
    // Parse relative time labels like "3시간 후", "In 3 h", "내일 05:30", etc.
    const minMatch = whenLabel.match(/(\d+)\s*(min|분)/i);
    if (minMatch) return parseInt(minMatch[1]) * 60_000;

    const hourMatch = whenLabel.match(/(\d+)\s*(h|시간|hour)/i);
    if (hourMatch) return parseInt(hourMatch[1]) * 3_600_000;

    if (/now|지금/i.test(whenLabel)) return 0;
    if (/1\s*hour|1시간/i.test(whenLabel)) return 3_600_000;
    if (/tomorrow|내일/i.test(whenLabel)) return 18 * 3_600_000;
    if (/today|오늘/i.test(whenLabel)) return 6 * 3_600_000;

    const dayMatch = whenLabel.match(/(\d+)\s*(day|일)/i);
    if (dayMatch) return parseInt(dayMatch[1]) * 24 * 3_600_000;

    return 24 * 3_600_000; // default: far future
}

const UpcomingOpportunities: React.FC<Props> = ({ objects }) => {
    const t = usePhotoGuideI18n();

    // Collect objects that have a "next" state
    const items: UpcomingItem[] = objects
        .filter((o) => o.nextText && o.nextWhenLabel)
        .map((o) => ({
            icon: o.icon,
            accent: o.accent,
            nextText: o.nextText!,
            nextWhenLabel: o.nextWhenLabel!,
            hintText: o.hintText,
            sortMs: estimateSortMs(o.nextWhenLabel!),
        }))
        .sort((a, b) => a.sortMs - b.sortMs)
        .slice(0, 5);

    if (items.length === 0) {
        return (
            <div className="glass-card-inner rounded-xl px-4 py-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                    {t.upcoming.heading}
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                    {t.upcoming.noUpcoming}
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card-inner rounded-xl px-4 py-3">
            <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                {t.upcoming.heading}
            </div>
            <div className="space-y-2.5">
                {items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                        {/* Timeline dot + line */}
                        <div className="flex flex-col items-center shrink-0 pt-0.5">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ background: item.accent, boxShadow: `0 0 6px ${item.accent}60` }}
                            />
                            {idx < items.length - 1 && (
                                <div className="w-px flex-1 min-h-[20px] bg-white/10 mt-1" />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-1">
                            {/* Time label */}
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <Clock className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
                                <span className="text-[11px] font-semibold" style={{ color: item.accent }}>
                                    {item.nextWhenLabel}
                                </span>
                            </div>
                            {/* What's coming */}
                            <div className="text-sm text-[var(--text-primary)] leading-snug">
                                <span className="mr-1" aria-hidden="true">{item.icon}</span>
                                {item.nextText}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UpcomingOpportunities;
