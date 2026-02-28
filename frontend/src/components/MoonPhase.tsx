import React, { useState } from 'react';
import './MoonPhase.css';
import { type AstronomyDay } from '../types/weather';
import { getPhaseDef, formatDate, formatTime, calculateDuration, calculateObservationWindows, minutesToTime, formatDurationMins } from '../utils/astronomyUtils';

interface MoonPhaseProps {
    data: AstronomyDay[];
    timezone?: string;
}

const MoonPhase: React.FC<MoonPhaseProps> = ({ data, timezone }) => {
    const [activeTab, setActiveTab] = useState<'moon' | 'sun' | 'optimal'>('moon');
    const today = data && data.length > 0 ? data[0] : null;
    const currentPhase = today ? getPhaseDef(today.moon.phase) : { name: '', class: '', icon: '' };

    if (!today) return null;

    const tabs = [
        { key: 'moon' as const, label: 'Moon Phase' },
        { key: 'sun' as const, label: 'Sun Times' },
        { key: 'optimal' as const, label: 'Best Time' },
    ];

    return (
        <div className="glass-card w-full mt-6 overflow-hidden animate-fade-in-up delay-4" style={{ animationFillMode: 'backwards' }}>
            {/* Tab Navigation */}
            <div className="flex border-b border-[var(--glass-border)]">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        className={`flex-1 py-3.5 px-3 text-sm font-semibold transition-all border-b-2 ${
                            activeTab === tab.key
                                ? 'text-[var(--text-bright)] border-[var(--accent)] bg-[var(--bg-surface)]'
                                : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                        }`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="p-5 sm:p-6 min-h-[260px]">
                {/* Moon Tab */}
                {activeTab === 'moon' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-[var(--text-bright)] mb-1">{currentPhase.name}</h3>
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Illumination: <span className="font-data font-bold text-[var(--text-primary)]">{Math.round(today.moon.fraction * 100)}%</span>
                                </p>
                            </div>
                            <div className="moon-visual">
                                <div className="moon-glow" style={{ '--glow-opacity': today.moon.fraction } as React.CSSProperties} />
                                <div className={`moon-sphere ${currentPhase.class}`}>
                                    <div className="moon-shadow" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            {data.map((day, idx) => (
                                <div key={idx} className="glass-card-inner p-3 sm:p-3.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                                        <span className="text-xs sm:text-sm font-medium text-[var(--accent)] shrink-0">{formatDate(day.date, idx)}</span>
                                        <div className="text-xs sm:text-sm text-[var(--text-secondary)] font-data">
                                            {(() => {
                                                const isNextDay = (timeStr: string | null, baseDateStr: string) => {
                                                    if (!timeStr) return false;
                                                    const eventDate = new Date(timeStr);
                                                    const baseDate = new Date(baseDateStr);
                                                    return eventDate.getDate() !== baseDate.getDate();
                                                };
                                                const moonData = day.moon;
                                                if (moonData.alwaysUp) return <span className="text-amber-400">Always Up</span>;
                                                if (moonData.alwaysDown) return <span className="text-[var(--text-tertiary)]">Always Down</span>;
                                                return (
                                                    <span className="flex items-center gap-2 sm:gap-3">
                                                        <span>Rise <strong className="text-[var(--text-primary)]">{formatTime(day.moon.rise, timezone)}</strong>{isNextDay(day.moon.rise, day.date) ? <span className="text-[10px] text-[var(--text-tertiary)] ml-0.5">(+1)</span> : ''}</span>
                                                        <span className="text-[var(--glass-border)]">|</span>
                                                        <span>Set <strong className="text-[var(--text-primary)]">{formatTime(day.moon.set, timezone)}</strong>{isNextDay(day.moon.set, day.date) ? <span className="text-[10px] text-[var(--text-tertiary)] ml-0.5">(+1)</span> : ''}</span>
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="glass-card-inner p-4 text-sm text-[var(--text-secondary)] border-l-2 border-[var(--accent)]">
                            {today.moon.fraction > 0.7
                                ? "Bright moon - challenging for deep-sky imaging."
                                : today.moon.fraction < 0.2
                                    ? "Dark moon - excellent conditions for deep-sky targets."
                                    : "Moderate moon - good for filtered or planetary work."}
                        </div>
                    </div>
                )}

                {/* Sun Tab */}
                {activeTab === 'sun' && (
                    <div className="animate-fade-in">
                        <div className="flex flex-col items-center mb-5">
                            <div className="sun-visual">
                                <div className="sun-corona" />
                                <div className="sun-outer-rays">
                                    {[...Array(12)].map((_, i) => <div key={i} className="sun-outer-ray" />)}
                                </div>
                                <div className="sun-rays">
                                    {[...Array(8)].map((_, i) => <div key={i} className="sun-ray" />)}
                                </div>
                                <div className="sun-sphere" />
                            </div>
                            <h3 className="text-lg font-bold text-[var(--text-bright)] mt-3">Sunrise & Sunset</h3>
                        </div>

                        <div className="space-y-2 mb-4">
                            {data.map((day, idx) => (
                                <div key={idx} className="glass-card-inner p-3 sm:p-3.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 mb-1">
                                        <span className="text-xs sm:text-sm font-medium text-[var(--accent)] shrink-0">{formatDate(day.date, idx)}</span>
                                        <div className="text-xs sm:text-sm text-[var(--text-secondary)] font-data flex items-center gap-2 sm:gap-3">
                                            <span>Rise <strong className="text-[var(--text-primary)]">{formatTime(day.sun.sunrise, timezone)}</strong></span>
                                            <span className="text-[var(--glass-border)]">|</span>
                                            <span>Set <strong className="text-[var(--text-primary)]">{formatTime(day.sun.sunset, timezone)}</strong></span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-[var(--text-tertiary)] font-data text-right">
                                        Night: {calculateDuration(day.sun.observableHours)}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="glass-card-inner p-4 text-sm text-[var(--text-secondary)] border-l-2 border-amber-500/50">
                            Best visibility begins 1-2 hours after sunset.
                        </div>
                    </div>
                )}

                {/* Best Time Tab */}
                {activeTab === 'optimal' && (
                    <div className="animate-fade-in">
                        <div className="text-center mb-4">
                            <h3 className="text-lg font-bold text-[var(--text-bright)]">Optimal Observation Times</h3>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Calculated from Moon/Sun cycles</p>
                        </div>

                        <div className="space-y-4">
                            {data.map((day, idx) => {
                                const nextDay = data[idx + 1];
                                const windows = calculateObservationWindows(day, nextDay);
                                const totalMins = windows.reduce((acc, w) => acc + w.duration, 0);
                                const totalTimeStr = totalMins > 0 ? formatDurationMins(totalMins) : 'No dark time';

                                return (
                                    <div key={idx} className="glass-card-inner p-4">
                                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-[var(--glass-border)]">
                                            <span className="text-sm font-semibold text-[var(--accent)]">{formatDate(day.date, idx)}</span>
                                            <span className="text-xs font-data" style={{ color: totalMins > 0 ? 'var(--seeing-exceptional)' : 'var(--text-tertiary)' }}>
                                                {totalMins > 0 ? `Total ${totalTimeStr}` : totalTimeStr}
                                            </span>
                                        </div>

                                        {windows.length > 0 ? (
                                            <div className="space-y-2.5">
                                                {windows.map((w, wIdx) => (
                                                    <div key={wIdx} className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--glass-border)]">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-base">{w.icon}</span>
                                                            <span className="text-xs font-data font-bold text-[var(--text-primary)] flex-1">
                                                                {minutesToTime(w.start)} - {minutesToTime(w.end)}
                                                            </span>
                                                            <span className="text-xs font-data bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--glass-border)]">
                                                                {formatDurationMins(w.duration)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-xs text-[var(--text-tertiary)]">{w.condition}</span>
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                                w.quality === 'excellent' ? 'bg-emerald-500/15 text-emerald-400' :
                                                                w.quality === 'good' ? 'bg-blue-500/15 text-blue-400' :
                                                                'bg-amber-500/15 text-amber-400'
                                                            }`}>
                                                                {w.quality === 'excellent' ? 'Excellent' : w.quality === 'good' ? 'Good' : 'Fair'}
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-2">
                                                            <div className={`h-full quality-fill-${w.quality} rounded-full`} style={{ width: `${w.score}%` }} />
                                                        </div>
                                                        <p className="text-xs text-[var(--text-tertiary)] italic">{w.tip}</p>
                                                    </div>
                                                ))}

                                                {windows.length > 0 && (
                                                    <div className="p-2.5 border-l-2 border-emerald-500/50 text-xs text-emerald-400/80 bg-emerald-500/5 rounded-r-lg">
                                                        Best start: <strong>{minutesToTime(windows.reduce((p, c) => c.score > p.score ? c : p).start)}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-[var(--text-tertiary)]">
                                                <div className="text-2xl mb-2">&#127765;</div>
                                                <h4 className="text-sm font-medium text-[var(--text-secondary)]">Unsuitable for Deep Sky</h4>
                                                <p className="text-xs mt-1">Moon too bright. Try planetary observation.</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="glass-card-inner p-4 mt-4 border-l-2 border-[var(--accent)]">
                            <ul className="text-xs text-[var(--text-tertiary)] space-y-1.5 pl-3 list-disc">
                                <li>Starts 1h after sunset (stabilization)</li>
                                <li>Ends 1h before sunrise</li>
                                <li>Avoids bright moon periods</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MoonPhase;
