import React from 'react';
import type { ForecastItem, AstronomyDay } from '../types/weather';
import useI18n from '../hooks/useI18n';
import { isNightSlot } from '../utils/nightDetection';
import { getScoreColor, getSeeingColor } from '../utils/weatherColors';

interface ForecastListProps {
    forecast: ForecastItem[];
    timezone?: string;
    astronomy?: AstronomyDay[];
}

const ForecastList: React.FC<ForecastListProps> = ({ forecast, timezone, astronomy }) => {
    const t = useI18n();
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const hour = parseInt(date.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10);
        return {
            day: date.toLocaleDateString(undefined, { timeZone: tz, weekday: 'short' }),
            time: hour.toString().padStart(2, '0') + ':00',
        };
    };

    // 날짜별 그룹핑
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    const grouped = React.useMemo(() => {
        const map: { dateKey: string; label: string; dateDisplay: string; points: ForecastItem[] }[] = [];
        let currentKey = '';

        for (const point of forecast) {
            const dateKey = new Date(point.time).toLocaleDateString('en-CA', { timeZone: tz });
            if (dateKey !== currentKey) {
                currentKey = dateKey;
                // 날짜 라벨 결정
                const diff = Math.round((new Date(dateKey + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000);
                const label = diff === 0 ? t.forecastList.today : diff === 1 ? t.forecastList.tomorrow : diff === 2 ? t.forecastList.dayAfter : new Date(point.time).toLocaleDateString(undefined, { timeZone: tz, month: 'short', day: 'numeric' });
                // 날짜 표시 (월/일)
                const dateDisplay = new Date(point.time).toLocaleDateString(undefined, { timeZone: tz, month: 'numeric', day: 'numeric' });
                map.push({ dateKey, label, dateDisplay, points: [] });
            }
            map[map.length - 1].points.push(point);
        }
        return map;
    }, [forecast, tz, todayStr, t]);

    // Find closest slot to now (for NOW indicator)
    const closestNowIdx = React.useMemo(() => {
        const now = Date.now();
        let minDiff = Infinity;
        let idx = -1;
        forecast.forEach((f, i) => {
            const diff = Math.abs(new Date(f.time).getTime() - now);
            if (diff < minDiff) { minDiff = diff; idx = i; }
        });
        return idx;
    }, [forecast]);

    return (
        <div className="glass-card w-full p-5 sm:p-6 mt-6 animate-fade-in-up delay-2" style={{ animationFillMode: 'backwards' }}>
            <div className="flex justify-between items-center mb-5">
                <div>
                    <h3 className="text-xl lg:text-2xl font-bold text-[var(--text-bright)]">
                        {t.forecastList.title}
                    </h3>
                    <p className="text-xs lg:text-sm font-data text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5">
                        {t.forecastList.subtitle} &middot; {new Date().toLocaleString(undefined, { timeZone: tz, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--glass-border)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] lg:text-xs font-data text-emerald-400 uppercase tracking-wider font-medium">{t.forecastList.live}</span>
                </div>
            </div>

            <div className="flex overflow-x-auto gap-2.5 pb-3 no-scrollbar snap-x snap-mandatory -mx-1 px-1">
                {grouped.map((group) => (
                    <React.Fragment key={group.dateKey}>
                        {/* Day separator */}
                        <div className="flex-shrink-0 flex items-center justify-center snap-start">
                            <div className="flex flex-col items-center gap-1 px-2">
                                <span className="text-[11px] font-data text-[var(--accent)] uppercase tracking-widest font-bold whitespace-nowrap">
                                    {group.label}
                                </span>
                                <span className="text-[10px] font-data text-[var(--text-tertiary)] whitespace-nowrap">
                                    {group.dateDisplay}
                                </span>
                                <div className="w-px h-6 bg-[var(--accent)]/20" />
                            </div>
                        </div>

                        {group.points.map((point: ForecastItem) => {
                            const globalIdx = forecast.indexOf(point);
                            const isNow = globalIdx === closestNowIdx;
                            const { day, time } = formatTime(point.time);
                            const isNight = isNightSlot(point.time, astronomy, tz);
                            const s = point.scores.seeing;
                            const seeingColor = getSeeingColor(s);
                            const scoreColor = getScoreColor(point.score);
                            const confidence = point.raw?.confidence ?? 70;

                            return (
                                <div
                                    key={`${point.time}-${point.timepoint}`}
                                    className={`flex-shrink-0 snap-start group relative glass-card-inner p-3.5 flex flex-col items-center min-w-[96px] transition-all duration-200 hover:bg-[rgba(255,255,255,0.06)] ${!isNight ? 'opacity-40' : ''} ${isNow ? 'ring-1 ring-[var(--accent)]/50' : ''}`}
                                >
                                    {/* 낮/밤 indicator */}
                                    <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isNight ? 'bg-indigo-400/60' : 'bg-amber-400/60'}`} />

                                    {/* Time — NOW 슬롯은 인라인 강조 */}
                                    {isNow ? (
                                        <span className="text-[10px] font-data font-bold text-emerald-400 uppercase tracking-wider">{t.forecastList.now}</span>
                                    ) : (
                                        <span className="text-xs text-[var(--text-secondary)] font-medium">{day}</span>
                                    )}
                                    <span className={`text-[11px] font-data ${isNow ? '' : 'mb-3'} ${isNow ? 'text-emerald-400/70 font-bold' : 'text-[var(--text-tertiary)]'}`}>{time}</span>
                                    {isNow && (
                                        <span className="text-[9px] font-data text-[var(--text-tertiary)] mb-2">{t.forecastList.forecast}</span>
                                    )}

                                    {/* Score */}
                                    <span
                                        className="font-data text-2xl font-bold tracking-tight transition-transform group-hover:scale-105"
                                        style={{ color: scoreColor, fontVariantNumeric: 'tabular-nums' }}
                                    >
                                        {Math.round(point.score)}
                                    </span>
                                    <span className="text-[10px] font-data uppercase tracking-widest text-[var(--text-tertiary)] mb-1">{point.grade}</span>

                                    {/* Seeing micro-bar */}
                                    <div className="w-full mt-2 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-medium">{t.forecastList.see}</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-[11px] font-data font-bold" style={{ color: seeingColor }}>{s.toFixed(1)}</span>
                                                {point.usp?.seeing != null && (
                                                    <span className="text-[9px] font-data text-cyan-400/60">{point.usp.seeing.toFixed(1)}&#8243;</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${Math.max(5, 100 - (s / 8) * 100)}%`,
                                                    background: seeingColor
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Confidence */}
                                    <div className="mt-2 w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full opacity-40"
                                            style={{ width: `${confidence}%`, background: 'var(--accent)' }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-data text-[var(--text-tertiary)] mt-1">{confidence}%</span>
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default ForecastList;
