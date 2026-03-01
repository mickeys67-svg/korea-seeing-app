import React from 'react';
import type { ForecastItem } from '../types/weather';
import useI18n from '../hooks/useI18n';

interface ForecastListProps {
    forecast: ForecastItem[];
    timezone?: string;
}

const ForecastList: React.FC<ForecastListProps> = ({ forecast, timezone }) => {
    const t = useI18n();
    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const hour = parseInt(date.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10);
        return {
            day: date.toLocaleDateString('ko-KR', { timeZone: tz, weekday: 'short' }),
            time: hour.toString().padStart(2, '0') + ':00',
            isNight: hour < 6 || hour > 18
        };
    };

    const getScoreColor = (score: number): string => {
        if (score >= 85) return 'var(--seeing-exceptional)';
        if (score >= 70) return 'var(--seeing-excellent)';
        if (score >= 55) return 'var(--seeing-good)';
        if (score >= 40) return 'var(--seeing-fair)';
        if (score >= 25) return 'var(--seeing-poor)';
        return 'var(--seeing-very-poor)';
    };

    const getSeeingColor = (s: number): string => {
        if (s <= 2) return 'var(--seeing-exceptional)';
        if (s <= 4) return 'var(--seeing-good)';
        if (s <= 6) return 'var(--seeing-fair)';
        return 'var(--seeing-very-poor)';
    };

    return (
        <div className="glass-card w-full p-5 sm:p-6 mt-6 animate-fade-in-up delay-2" style={{ animationFillMode: 'backwards' }}>
            <div className="flex justify-between items-center mb-5">
                <div>
                    <h3 className="text-xl lg:text-2xl font-bold text-[var(--text-bright)]">
                        {t.forecastList.title}
                    </h3>
                    <p className="text-xs lg:text-sm font-data text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5">
                        {t.forecastList.subtitle} &middot; {forecast.length} {t.forecastList.datapoints}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--glass-border)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] lg:text-xs font-data text-emerald-400 uppercase tracking-wider font-medium">{t.forecastList.live}</span>
                </div>
            </div>

            <div className="flex overflow-x-auto gap-2.5 pb-3 no-scrollbar snap-x snap-mandatory -mx-1 px-1">
                {forecast.map((point: ForecastItem, idx: number) => {
                    const { day, time, isNight } = formatTime(point.time);
                    const s = point.scores.seeing;
                    const seeingColor = getSeeingColor(s);
                    const scoreColor = getScoreColor(point.score);
                    const confidence = point.raw?.confidence || 70;

                    return (
                        <div
                            key={idx}
                            className="flex-shrink-0 snap-start group relative glass-card-inner p-3.5 flex flex-col items-center min-w-[96px] transition-all duration-200 hover:bg-[rgba(255,255,255,0.06)]"
                        >
                            {/* Night indicator */}
                            {isNight && (
                                <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-400/60 rounded-full" />
                            )}

                            {/* Time */}
                            <span className="text-xs text-[var(--text-secondary)] font-medium">{day}</span>
                            <span className="text-[11px] font-data text-[var(--text-tertiary)] mb-3">{time}</span>

                            {/* Score */}
                            <span
                                className="font-data text-2xl font-bold tracking-tight transition-transform group-hover:scale-105"
                                style={{ color: scoreColor }}
                            >
                                {point.score}
                            </span>
                            <span className="text-[10px] font-data uppercase tracking-widest text-[var(--text-tertiary)] mb-1">{point.grade}</span>

                            {/* Seeing micro-bar */}
                            <div className="w-full mt-2 space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-medium">{t.forecastList.see}</span>
                                    <span className="text-[11px] font-data font-bold" style={{ color: seeingColor }}>{s.toFixed(1)}</span>
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
            </div>
        </div>
    );
};

export default ForecastList;
