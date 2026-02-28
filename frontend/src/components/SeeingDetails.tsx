import React from 'react';
import { Eye, Cloud, Wind, Droplets, Plane, ThermometerSun, ChevronRight } from 'lucide-react';
import InfoModal from './InfoModal';
import type { ForecastItem } from '../types/weather';

interface SeeingProps {
    data: ForecastItem;
}

const SeeingDetails: React.FC<SeeingProps> = ({ data }) => {
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
        switch (grade) {
            case 'S': return 'Exceptional';
            case 'A': return 'Excellent';
            case 'B': return 'Good';
            case 'C': return 'Fair';
            default: return 'Poor';
        }
    };

    const scoreColor = getScoreColor(data.score);
    const scorePercent = Math.min(data.score, 100);

    const metrics = React.useMemo(() => [
        {
            key: 'seeing', label: 'SEEING', value: scores.seeing,
            icon: <Eye className="w-5 h-5" />,
            modal: {
                title: "Astronomical Seeing",
                desc: "Atmospheric turbulence measurement. Lower = more stable air, sharper images. Scale: 0 (perfect) to 8 (severe turbulence).",
                ranges: [
                    { label: "0-2 (Excellent)", value: "Sub-arcsecond, stable" },
                    { label: "3-5 (Average)", value: "Moderate turbulence" },
                    { label: "6-8 (Poor)", value: "Severe turbulence" }
                ]
            }
        },
        {
            key: 'transparency', label: 'TRANSPARENCY', value: scores.transparency,
            icon: <Droplets className="w-5 h-5" />,
            modal: {
                title: "Sky Transparency",
                desc: "Atmospheric clarity for deep-sky objects. Lower = clearer sky, better contrast. Scale: 0 (crystal clear) to 8 (hazy).",
                ranges: [
                    { label: "0-2 (Clear)", value: "High contrast" },
                    { label: "6-8 (Hazy)", value: "Low visibility" }
                ]
            }
        },
        {
            key: 'cloudCover', label: 'CLOUD', value: scores.cloudCover,
            icon: <Cloud className="w-5 h-5" />,
            modal: {
                title: "Cloud Cover",
                desc: "Sky obstruction by clouds. Lower = clearer viewing windows. Scale: 0 (cloudless) to 8 (overcast).",
                ranges: [
                    { label: "0 (Clear)", value: "~0% coverage" },
                    { label: "8 (Overcast)", value: "~100% coverage" }
                ]
            }
        },
        {
            key: 'wind', label: 'WIND', value: scores.wind,
            icon: <Wind className="w-5 h-5" />,
            modal: {
                title: "Surface Wind",
                desc: "Ground-level wind affecting telescope stability. Lower = calmer conditions. Scale: 0 (calm) to 8 (strong gusts).",
                ranges: [
                    { label: "0 (Calm)", value: "< 2 m/s" },
                    { label: "8 (Strong)", value: "> 12 m/s" }
                ]
            }
        },
        {
            key: 'jetStream', label: 'JET STREAM', value: scores.jetStream,
            icon: <Plane className="w-5 h-5 rotate-45" />,
            modal: {
                title: "Jet Stream (250hPa)",
                desc: "High-altitude winds causing upper-atmosphere turbulence. Lower = less high-altitude distortion. Measured at ~10km altitude.",
                ranges: [
                    { label: "0 (Calm)", value: "< 50 kt" },
                    { label: "8 (Strong)", value: "> 150 kt" }
                ]
            }
        },
        {
            key: 'convection', label: 'CONVECTION', value: scores.convection,
            icon: <ThermometerSun className="w-5 h-5" />,
            modal: {
                title: "Atmospheric Convection",
                desc: "Vertical air instability (CAPE). Lower = more stable atmosphere, less thermal distortion.",
                ranges: [
                    { label: "0 (Stable)", value: "Low CAPE" },
                    { label: "8 (Unstable)", value: "High CAPE" }
                ]
            }
        }
    ], [scores]);

    return (
        <>
            <div className="glass-card w-full p-6 sm:p-8 animate-fade-in-up">
                {/* Hero Score */}
                <div className="flex flex-col items-center mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: scoreColor }} />
                        <span className="text-sm font-data uppercase tracking-[0.2em] text-[var(--text-bright)] font-semibold">
                            Observation Quality
                        </span>
                    </div>

                    {/* Circular Score Gauge */}
                    <div className="relative w-44 h-44 mb-4">
                        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                            <circle
                                cx="60" cy="60" r="52"
                                fill="none"
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth="6"
                            />
                            <circle
                                cx="60" cy="60" r="52"
                                fill="none"
                                stroke={scoreColor}
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={`${scorePercent * 3.27} 327`}
                                className="transition-all duration-1000 ease-out"
                                style={{ filter: `drop-shadow(0 0 8px ${scoreColor})` }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span
                                className="text-5xl font-data font-bold tracking-tight"
                                style={{ color: scoreColor }}
                            >
                                {data.score}
                            </span>
                            <span className="text-sm font-data text-[var(--text-tertiary)]">/100</span>
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
                            className="text-xl font-bold font-data"
                            style={{ color: scoreColor }}
                        >
                            {data.grade}
                        </span>
                        <span className="text-sm text-[var(--text-secondary)]">{getGradeLabel(data.grade)}</span>
                    </div>

                    {data.recommendation && (
                        <p className="text-[15px] text-[var(--text-secondary)] text-center mt-4 max-w-sm leading-relaxed px-4">
                            {data.recommendation}
                        </p>
                    )}
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent mb-6" />

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
                    {metrics.map((metric, idx) => {
                        const color = getComponentColor(metric.value);
                        return (
                            <button
                                key={idx}
                                onClick={() => setSelectedMetric(metric.modal)}
                                className="glass-card-inner p-4 sm:p-5 flex flex-col items-center gap-2.5 cursor-pointer group active:scale-95 transition-transform"
                            >
                                <div
                                    className="p-2 rounded-lg transition-colors"
                                    style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
                                >
                                    {metric.icon}
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-data font-bold" style={{ color }}>
                                        {metric.value}
                                    </span>
                                    <span className="text-xs font-data text-[var(--text-tertiary)]">/8</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                                        {metric.label}
                                    </span>
                                    <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Environment Bar */}
                <div className="flex items-center justify-around glass-card-inner p-4 rounded-xl">
                    <div className="flex items-center gap-2.5">
                        <Droplets className="w-4 h-4 text-blue-400/80" />
                        <div className="flex flex-col">
                            <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium">Humidity</span>
                            <span className="font-data text-base font-semibold text-blue-300">{data.rh2m}%</span>
                        </div>
                    </div>
                    <div className="w-px h-10 bg-[var(--glass-border)]" />
                    <div className="flex items-center gap-2.5">
                        <ThermometerSun className="w-4 h-4 text-amber-400/80" />
                        <div className="flex flex-col">
                            <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium">Temp</span>
                            <span className="font-data text-base font-semibold text-amber-300">{data.temp2m}°C</span>
                        </div>
                    </div>
                    <div className="w-px h-10 bg-[var(--glass-border)]" />
                    <div className="flex items-center gap-2.5">
                        <Wind className="w-4 h-4 text-cyan-400/80" />
                        <div className="flex flex-col">
                            <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium">Wind</span>
                            <span className="font-data text-base font-semibold text-cyan-300">{data.wind10m.speed}<span className="text-[11px] text-[var(--text-tertiary)]"> m/s</span></span>
                        </div>
                    </div>
                </div>
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
