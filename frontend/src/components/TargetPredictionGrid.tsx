import React, { useMemo } from 'react';
import { predictTargets } from '../utils/targetPrediction';
import type { ForecastItem } from '../types/weather';
import useI18n from '../hooks/useI18n';

interface Props {
    forecast: ForecastItem;
    moonFraction: number;
}

const getScoreColor = (score: number): string => {
    if (score >= 85) return 'var(--seeing-exceptional)';
    if (score >= 70) return 'var(--seeing-excellent)';
    if (score >= 55) return 'var(--seeing-good)';
    if (score >= 40) return 'var(--seeing-fair)';
    return 'var(--seeing-very-poor)';
};

const TargetPredictionGrid: React.FC<Props> = ({ forecast, moonFraction }) => {
    const t = useI18n();
    const results = useMemo(
        () => predictTargets(forecast, moonFraction),
        [forecast, moonFraction]
    );

    const targetNames: Record<string, string> = {
        planet: t.targets.planet,
        milkyway: t.targets.milkyway,
        nebula: t.targets.nebula,
        cluster: t.targets.cluster,
        galaxy: t.targets.galaxy,
    };

    const factorNames = t.targets.factors as Record<string, string>;

    return (
        <div className="relative z-10 mt-5">
            {/* Section header */}
            <div className="flex justify-between items-baseline mb-3">
                <span className="text-sm lg:text-base font-bold text-[var(--text-bright)] uppercase tracking-wider">
                    {t.targets.title}
                </span>
                <span className="text-[10px] lg:text-xs font-data text-[var(--text-tertiary)] uppercase tracking-wider">
                    {t.targets.subtitle}
                </span>
            </div>

            {/* 5-column target grid */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 lg:gap-3">
                {results.map(result => {
                    const color = getScoreColor(result.score);
                    const factor = factorNames[result.limitingFactor] ?? result.limitingFactor;

                    return (
                        <div
                            key={result.id}
                            className="glass-card-inner flex flex-col items-center p-2 sm:p-3 lg:p-4 gap-1 lg:gap-1.5 min-w-0 transition-all duration-500"
                            style={{
                                borderColor: `color-mix(in srgb, ${color} 18%, transparent)`,
                            }}
                        >
                            {/* Emoji */}
                            <span className="text-lg sm:text-2xl lg:text-3xl leading-none select-none">
                                {result.emoji}
                            </span>

                            {/* Target name */}
                            <span className="text-[8px] sm:text-[10px] lg:text-xs text-[var(--text-tertiary)] w-full text-center overflow-hidden text-ellipsis whitespace-nowrap leading-tight">
                                {targetNames[result.id]}
                            </span>

                            {/* Score number */}
                            <span
                                className="text-base sm:text-xl lg:text-2xl font-data font-bold leading-none"
                                style={{ color, textShadow: `0 0 12px ${color}60` }}
                            >
                                {result.score}
                            </span>

                            {/* Grade letter */}
                            <span
                                className="text-[9px] sm:text-[11px] lg:text-sm font-data font-bold tracking-widest leading-none"
                                style={{ color }}
                            >
                                {result.grade}
                            </span>

                            {/* Progress bar */}
                            <div className="w-full h-[2px] sm:h-[3px] lg:h-1 bg-white/5 rounded-full overflow-hidden mt-0.5">
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${result.score}%`, background: color }}
                                />
                            </div>

                            {/* Limiting factor */}
                            <span className="text-[7px] sm:text-[9px] lg:text-[11px] text-[var(--text-tertiary)] truncate w-full text-center leading-tight mt-0.5">
                                {factor}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TargetPredictionGrid;
