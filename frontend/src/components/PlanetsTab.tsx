import React, { useMemo } from 'react';
import { getPlanetPositions, azimuthToDirection, type PlanetInfo } from '../utils/planetPositions';
import useI18n from '../hooks/useI18n';

interface PlanetsTabProps {
    lat?: number;
    lon?: number;
    timezone?: string;
}

const PLANET_SYMBOLS: Record<string, string> = {
    mercury: '☿',
    venus: '♀',
    mars: '♂',
    jupiter: '♃',
    saturn: '♄',
};

const PlanetsTab: React.FC<PlanetsTabProps> = ({ lat, lon, timezone }) => {
    const t = useI18n();
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    const planets = useMemo(() => {
        if (lat == null || lon == null) return [];
        return getPlanetPositions(lat, lon);
    }, [lat, lon]);

    if (!planets.length) return null;

    const above = planets.filter(p => p.isAboveHorizon).sort((a, b) => b.altitude - a.altitude);
    const below = planets.filter(p => !p.isAboveHorizon).sort((a, b) => b.altitude - a.altitude);

    const formatRiseSet = (d: Date | null) => {
        if (!d) return '—';
        return d.toLocaleTimeString([], { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    };

    return (
        <div className="animate-fade-in space-y-4">
            {/* Title */}
            <div className="text-center mb-2">
                <h3 className="text-lg font-bold text-[var(--text-bright)]">{t.moonPhase.planetsTitle}</h3>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t.moonPhase.planetsSubtitle}</p>
            </div>

            {/* Above Horizon */}
            {above.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs font-data text-emerald-400 uppercase tracking-wider font-bold">
                            {t.moonPhase.aboveHorizon} ({above.length})
                        </span>
                    </div>
                    <div className="space-y-2">
                        {above.map(p => (
                            <PlanetCard key={p.name} planet={p} tz={tz} formatRiseSet={formatRiseSet} />
                        ))}
                    </div>
                </div>
            )}

            {/* Below Horizon */}
            {below.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-[var(--text-tertiary)]" />
                        <span className="text-xs font-data text-[var(--text-tertiary)] uppercase tracking-wider font-bold">
                            {t.moonPhase.belowHorizon} ({below.length})
                        </span>
                    </div>
                    <div className="space-y-2">
                        {below.map(p => (
                            <PlanetCard key={p.name} planet={p} tz={tz} dimmed formatRiseSet={formatRiseSet} />
                        ))}
                    </div>
                </div>
            )}

            {/* Tip */}
            <div className="glass-card-inner p-4 border-l-2 border-[var(--accent)]">
                <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{t.moonPhase.planetsTip}</p>
            </div>
        </div>
    );
};

const PlanetCard: React.FC<{
    planet: PlanetInfo;
    tz: string;
    dimmed?: boolean;
    formatRiseSet: (d: Date | null) => string;
}> = ({ planet, dimmed, formatRiseSet }) => {
    const t = useI18n();
    const symbol = PLANET_SYMBOLS[planet.name] || '·';
    const displayName = t.moonPhase.planetNames[planet.name as keyof typeof t.moonPhase.planetNames] || planet.name;

    const altColor = planet.altitude >= 30
        ? 'text-emerald-400'
        : planet.altitude > 0
            ? 'text-amber-400'
            : 'text-[var(--text-tertiary)]';

    return (
        <div className={`glass-card-inner p-3 sm:p-4 transition-opacity ${dimmed ? 'opacity-40' : ''}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <span className="text-xl w-7 text-center">{symbol}</span>
                    <span className="text-sm font-bold text-[var(--text-bright)]">{displayName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-data">
                    <span className="text-[var(--text-secondary)]">
                        Alt <strong className={altColor}>
                            {planet.altitude > 0 ? '+' : ''}{planet.altitude}°
                        </strong>
                    </span>
                    <span className="text-[var(--text-tertiary)]">
                        {planet.azimuth.toFixed(0)}° {azimuthToDirection(planet.azimuth)}
                    </span>
                </div>
            </div>
            <div className="flex gap-4 mt-1.5 text-[11px] text-[var(--text-tertiary)] font-data pl-9">
                <span>{t.moonPhase.rise} {formatRiseSet(planet.rise)}</span>
                <span>{t.moonPhase.set} {formatRiseSet(planet.set)}</span>
            </div>
        </div>
    );
};

export default PlanetsTab;
