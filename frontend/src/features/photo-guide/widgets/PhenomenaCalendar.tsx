/**
 * v5.0 Photo Guide — Natural phenomena calendar widget
 *
 * 30일 내 자연현상(블러드문·월식·일식·슈퍼문·유성우 등) 리스트 카드.
 */
import React from 'react';
import { Moon, Sparkles } from 'lucide-react';
import type { PhenomenaCalendarEntry } from '../types';
import { usePhotoGuideI18n } from '../i18n';

interface Props {
    items: PhenomenaCalendarEntry[];
    timezone?: string;
}

function formatDate(iso: string, tz?: string): string {
    try {
        return new Intl.DateTimeFormat(undefined, {
            month: 'short', day: 'numeric', timeZone: tz || undefined,
        }).format(new Date(iso));
    } catch {
        return iso.slice(0, 10);
    }
}
function formatTime(iso: string, tz?: string): string {
    try {
        return new Intl.DateTimeFormat(undefined, {
            hour: '2-digit', minute: '2-digit', timeZone: tz || undefined,
        }).format(new Date(iso));
    } catch {
        return iso.slice(11, 16);
    }
}

const ICON_FOR: Record<string, React.ComponentType<{ className?: string }>> = {
    'blood-moon': Moon,
    supermoon: Moon,
    'lunar-eclipse-total': Moon,
    'lunar-eclipse-partial': Moon,
    'lunar-eclipse-penumbral': Moon,
    'solar-eclipse-total': Sparkles,
    'solar-eclipse-partial': Sparkles,
    'solar-eclipse-annular': Sparkles,
    'meteor-shower': Sparkles,
};

const PhenomenaCalendar: React.FC<Props> = ({ items, timezone }) => {
    const t = usePhotoGuideI18n();

    if (!items || items.length === 0) {
        return (
            <div className="py-6 text-center text-xs text-[var(--text-tertiary)]">
                {t.phenomena.noEvents}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {items.map((p, idx) => {
                const Icon = ICON_FOR[p.type] ?? Sparkles;
                const label = (t.phenomena.type as Record<string, string>)[p.type] ?? p.type;
                const dDayLabel = t.phenomena.dDay(p.dDay);
                const dirLabel = p.direction
                    ? (t.direction as Record<string, string>)[p.direction] ?? p.direction
                    : null;
                return (
                    <div
                        key={`${p.type}-${p.date}-${idx}`}
                        className="glass-card-inner rounded-xl p-3 flex items-start gap-3"
                        style={{ borderLeft: '3px solid #c084fc' }}
                    >
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-purple-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-[var(--text-bright)]">
                                    {label}
                                </span>
                                <span className="text-[10px] font-data text-purple-300">
                                    {dDayLabel}
                                </span>
                                {p.visible === false && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-600/20 text-slate-400">
                                        not visible here
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                                {formatDate(p.date, timezone)}
                                {p.peakTime && (
                                    <span className="ml-2">
                                        · {formatTime(p.peakTime, timezone)}
                                    </span>
                                )}
                                {dirLabel && (
                                    <span className="ml-2 text-[var(--text-tertiary)]">
                                        · {dirLabel}
                                    </span>
                                )}
                                {typeof p.altitude === 'number' && (
                                    <span className="ml-2 text-[var(--text-tertiary)]">
                                        · alt {Math.round(p.altitude)}°
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default PhenomenaCalendar;
