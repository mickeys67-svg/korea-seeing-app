import React from 'react';
import { Eye, Cloud, Wind, Droplets, Plane, ThermometerSun, ChevronRight } from 'lucide-react';
import InfoModal from './InfoModal';
import TargetPredictionGrid from './TargetPredictionGrid';
import type { ForecastItem } from '../types/weather';
import useI18n from '../hooks/useI18n';

interface SeeingProps {
    data: ForecastItem;
    moonFraction?: number;
    isDaytime?: boolean;
    sunsetTime?: string | null;
    timezone?: string;
}

const SeeingDetails: React.FC<SeeingProps> = ({ data, moonFraction = 0.5, isDaytime = false, sunsetTime, timezone }) => {
    const t = useI18n();
    const [selectedMetric, setSelectedMetric] = React.useState<{ title: string; desc: string; ranges?: any[] } | null>(null);
    const scores = data.scores;

    const getScoreColor = React.useCallback((score: number): string => {
        if (score >= 85) return 'var(--seeing-exceptional)';
        if (score >= 70) return 'var(--seeing-excellent)';
        if (score >= 55) return 'var(--seeing-good)';
        if (score >= 40) return 'var(--seeing-fair)';
        if (score >= 25) return 'var(--seeing-poor)';
        return 'var(--seeing-very-poor)';
    }, []);

    const getComponentColor = React.useCallback((value: number): string => {
        if (value <= 2) return 'var(--seeing-exceptional)';
        if (value <= 4) return 'var(--seeing-good)';
        if (value <= 6) return 'var(--seeing-fair)';
        return 'var(--seeing-very-poor)';
    }, []);

    const getGradeLabel = (grade: string) => {
        const map: Record<string, keyof typeof t.seeingDetails.grades> = {
            S: 'S', A: 'A', B: 'B', C: 'C',
        };
        return t.seeingDetails.grades[map[grade] || 'D'];
    };

    const scoreColor = getScoreColor(data.score);
    const scorePercent = Math.min(data.score, 100);

    const metrics = React.useMemo(() => [
        {
            key: 'seeing', label: t.seeingDetails.metrics.SEEING, value: scores.seeing,
            icon: <Eye className="w-5 h-5" />,
            modal: {
                title: t.seeingDetails.modalTitles.seeing,
                desc: t.seeingDetails.modalDescs.seeing,
                ranges: [
                    { label: "0-2", value: t.seeingDetails.grades.S },
                    { label: "3-5", value: t.seeingDetails.grades.C },
                    { label: "6-8", value: t.seeingDetails.grades.D }
                ]
            }
        },
        {
            key: 'transparency', label: t.seeingDetails.metrics.TRANSPARENCY, value: scores.transparency,
            icon: <Droplets className="w-5 h-5" />,
            modal: {
                title: t.seeingDetails.modalTitles.transparency,
                desc: t.seeingDetails.modalDescs.transparency,
                ranges: [
                    { label: "0-2", value: t.seeingDetails.grades.A },
                    { label: "6-8", value: t.seeingDetails.grades.D }
                ]
            }
        },
        {
            key: 'cloudCover', label: t.seeingDetails.metrics.CLOUD, value: scores.cloudCover,
            icon: <Cloud className="w-5 h-5" />,
            modal: {
                title: t.seeingDetails.modalTitles.cloud,
                desc: t.seeingDetails.modalDescs.cloud,
                ranges: [
                    ...(data.cloudLayers ? [
                        { label: t.seeingDetails.cloudLayers.low, value: data.cloudLayers.low != null ? `${data.cloudLayers.low}%` : '—' },
                        { label: t.seeingDetails.cloudLayers.mid, value: data.cloudLayers.mid != null ? `${data.cloudLayers.mid}%` : '—' },
                        { label: t.seeingDetails.cloudLayers.high, value: data.cloudLayers.high != null ? `${data.cloudLayers.high}%` : '—' },
                    ] : []),
                    { label: "0", value: "~0%" },
                    { label: "8", value: "~100%" }
                ]
            }
        },
        {
            key: 'wind', label: t.seeingDetails.metrics.WIND, value: scores.wind,
            icon: <Wind className="w-5 h-5" />,
            modal: {
                title: t.seeingDetails.modalTitles.wind,
                desc: t.seeingDetails.modalDescs.wind,
                ranges: [
                    { label: "0", value: "< 2 m/s" },
                    { label: "8", value: "> 12 m/s" }
                ]
            }
        },
        {
            key: 'jetStream', label: t.seeingDetails.metrics.JET_STREAM, value: scores.jetStream,
            icon: <Plane className="w-5 h-5 rotate-45" />,
            modal: {
                title: t.seeingDetails.modalTitles.jetStream,
                desc: t.seeingDetails.modalDescs.jetStream,
                ranges: [
                    { label: "0", value: "< 50 kt" },
                    { label: "8", value: "> 150 kt" }
                ]
            }
        },
        {
            key: 'convection', label: t.seeingDetails.metrics.CONVECTION, value: scores.convection,
            icon: <ThermometerSun className="w-5 h-5" />,
            modal: {
                title: t.seeingDetails.modalTitles.convection,
                desc: t.seeingDetails.modalDescs.convection,
                ranges: [
                    { label: "0", value: "Low CAPE" },
                    { label: "8", value: "High CAPE" }
                ]
            }
        }
    ], [scores, t]);

    // 일몰 시간 포맷 (location timezone)
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formatSunset = (iso: string) => {
        return new Date(iso).toLocaleTimeString([], { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    };

    return (
        <>
            <div className="glass-card w-full p-6 sm:p-8 animate-fade-in-up">
                {/* 낮 시간 배너 */}
                {isDaytime && (
                    <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <span className="text-xl shrink-0">☀️</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-data uppercase tracking-wider text-amber-400/90 font-semibold">
                                {t.common.daytime}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                {t.common.daytimeDesc}
                                {sunsetTime ? ` · ${formatSunset(sunsetTime)}` : ''}
                            </p>
                        </div>
                    </div>
                )}
                {/* Hero Score */}
                <div className="flex flex-col items-center mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: scoreColor }} />
                        <span className="text-sm lg:text-lg font-data uppercase tracking-[0.2em] text-[var(--text-bright)] font-semibold">
                            {t.seeingDetails.title}
                        </span>
                    </div>

                    {/* Circular Score Gauge */}
                    <div className="relative w-52 h-52 lg:w-64 lg:h-64 mb-5">
                        <svg viewBox="-14 -14 148 148" className="w-full h-full -rotate-90">
                            {/* Outer decorative ring */}
                            <circle
                                cx="60" cy="60" r="58"
                                fill="none"
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth="0.75"
                            />
                            {/* Background track */}
                            <circle
                                cx="60" cy="60" r="52"
                                fill="none"
                                stroke="rgba(255,255,255,0.08)"
                                strokeWidth="8"
                            />
                            {/* Progress arc */}
                            <circle
                                cx="60" cy="60" r="52"
                                fill="none"
                                stroke={scoreColor}
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={`${scorePercent * 3.27} 327`}
                                className="transition-all duration-1000 ease-out"
                                style={{ filter: `drop-shadow(0 0 12px ${scoreColor})` }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span
                                className="text-5xl lg:text-6xl font-data font-bold tracking-tight"
                                style={{ color: scoreColor, textShadow: `0 0 30px ${scoreColor}50`, fontVariantNumeric: 'tabular-nums' }}
                            >
                                {Math.round(data.score)}
                            </span>
                            <span className="text-xs lg:text-sm font-data text-[var(--text-tertiary)] tracking-wider">/ 100</span>
                            {data.usp?.seeing != null && (
                                <span className="text-sm lg:text-base font-data text-cyan-400/80 mt-1 tracking-wide">
                                    {data.usp.seeing.toFixed(1)}&#8243;
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Grade Badge */}
                    <div
                        className="flex items-center gap-2 px-5 py-2 rounded-full border"
                        style={{
                            borderColor: `color-mix(in srgb, ${scoreColor} 30%, transparent)`,
                            background: `color-mix(in srgb, ${scoreColor} 8%, transparent)`
                        }}
                    >
                        <span
                            className="text-xl lg:text-2xl font-bold font-data"
                            style={{ color: scoreColor }}
                        >
                            {data.grade}
                        </span>
                        <span className="text-sm lg:text-base text-[var(--text-secondary)]">{getGradeLabel(data.grade)}</span>
                    </div>

                    {data.recommendation && (
                        <p className="text-[15px] lg:text-lg text-[var(--text-secondary)] text-center mt-4 max-w-sm lg:max-w-lg leading-relaxed px-4">
                            {data.recommendation}
                        </p>
                    )}
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent mb-6" />

                {/* Metrics Grid — 2col mobile, 3col desktop */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4 mb-6">
                    {metrics.map((metric, idx) => {
                        const color = getComponentColor(metric.value);
                        return (
                            <button
                                key={idx}
                                onClick={() => setSelectedMetric(metric.modal)}
                                className="glass-card-inner p-3 sm:p-5 flex flex-col items-center gap-2 sm:gap-2.5 cursor-pointer group active:scale-95 transition-transform min-w-0"
                            >
                                <div
                                    className="p-1.5 sm:p-2 rounded-lg transition-colors"
                                    style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
                                >
                                    {metric.icon}
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xl sm:text-2xl lg:text-3xl font-data font-bold" style={{ color }}>
                                            {metric.value}
                                        </span>
                                        <span className="text-xs lg:text-sm font-data text-[var(--text-tertiary)]">/8</span>
                                    </div>
                                    {metric.key === 'seeing' && data.usp?.seeing != null && (
                                        <span className="text-[10px] sm:text-xs font-data text-cyan-400/70 -mt-0.5">
                                            {data.usp.seeing.toFixed(1)}&#8243;
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 min-w-0">
                                    <span className="text-[10px] sm:text-xs lg:text-sm text-[var(--text-secondary)] uppercase tracking-wider font-semibold truncate">
                                        {metric.label}
                                    </span>
                                    <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Environment Bar */}
                <div className="flex items-center justify-around glass-card-inner p-3 sm:p-4 rounded-xl">
                    <div className="flex items-center gap-1.5 sm:gap-2.5">
                        <Droplets className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-blue-400/80 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-[11px] lg:text-sm uppercase tracking-wider text-[var(--text-tertiary)] font-medium">{t.common.humidity}</span>
                            <span className="font-data text-sm sm:text-base lg:text-lg font-semibold text-blue-300">{data.rh2m}%</span>
                        </div>
                    </div>
                    <div className="w-px h-8 sm:h-10 bg-[var(--glass-border)]" />
                    <div className="flex items-center gap-1.5 sm:gap-2.5">
                        <ThermometerSun className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-400/80 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-[11px] lg:text-sm uppercase tracking-wider text-[var(--text-tertiary)] font-medium">{t.common.temp}</span>
                            <span className="font-data text-sm sm:text-base lg:text-lg font-semibold text-amber-300">{data.temp2m}°C</span>
                        </div>
                    </div>
                    <div className="w-px h-8 sm:h-10 bg-[var(--glass-border)]" />
                    <div className="flex items-center gap-1.5 sm:gap-2.5">
                        <Wind className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-cyan-400/80 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-[11px] lg:text-sm uppercase tracking-wider text-[var(--text-tertiary)] font-medium">{t.common.wind}</span>
                            <span className="font-data text-sm sm:text-base lg:text-lg font-semibold text-cyan-300">{data.wind10m.speed}<span className="text-[10px] sm:text-[11px] text-[var(--text-tertiary)]"> m/s</span></span>
                        </div>
                    </div>
                </div>

                {/* Target Suitability Grid */}
                <TargetPredictionGrid forecast={data} moonFraction={moonFraction} />
            </div>

            <InfoModal
                isOpen={!!selectedMetric}
                onClose={() => setSelectedMetric(null)}
                title={selectedMetric?.title || ''}
                description={selectedMetric?.desc || ''}
                ranges={selectedMetric?.ranges}
            />
        </>
    );
};

export default SeeingDetails;
