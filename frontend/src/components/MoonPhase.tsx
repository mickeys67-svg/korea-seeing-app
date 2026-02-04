import React, { useState } from 'react';
import './MoonPhase.css';
import { type AstronomyDay } from '../types/weather';
import { getPhaseDef, formatDate, formatTime, calculateDuration, calculateObservationWindows, minutesToTime, formatDurationMins } from '../utils/astronomyUtils';

interface MoonPhaseProps {
    data: AstronomyDay[];
}

const MoonPhase: React.FC<MoonPhaseProps> = ({ data }) => {
    const [activeTab, setActiveTab] = useState<'moon' | 'sun' | 'optimal'>('moon');

    // Use current day data (first element)
    const today = data && data.length > 0 ? data[0] : null;

    const currentPhase = today ? getPhaseDef(today.moon.phase) : { name: '', class: '', icon: '' };

    if (!today) return null;

    return (
        <div className="moon-phase-card-expanded w-full max-w-md shadow-lg">
            {/* Tab Nav */}
            <div className="tab-navigation">
                <button
                    className={`tab-btn ${activeTab === 'moon' ? 'active' : ''}`}
                    onClick={() => setActiveTab('moon')}
                >
                    🌙 Moon Phase
                </button>
                <button
                    className={`tab-btn ${activeTab === 'sun' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sun')}
                >
                    🌅 Sun Times
                </button>
                <button
                    className={`tab-btn ${activeTab === 'optimal' ? 'active' : ''}`}
                    onClick={() => setActiveTab('optimal')}
                >
                    ⭐ Best Time
                </button>
            </div>

            <div className="tab-content">
                {/* Moon Tab */}
                {activeTab === 'moon' && (
                    <div className="animate-fade-in">
                        <div className="moon-header">
                            <div className="moon-info">
                                <h3>{currentPhase.name}</h3>
                                <p className="moon-illumination">Illumination: <span className="text-white font-bold">{Math.round(today.moon.fraction * 100)}</span>%</p>
                            </div>
                            <div className="moon-visual">
                                <div className="moon-glow" style={{ '--glow-opacity': today.moon.fraction } as React.CSSProperties}></div>
                                <div className={`moon-sphere ${currentPhase.class}`}>
                                    <div className="moon-shadow"></div>
                                </div>
                            </div>
                        </div>

                        <div className="time-table">
                            {data.map((day, idx) => (
                                <div key={idx} className="time-row">
                                    <span className="date-label">{formatDate(day.date, idx)}</span>
                                    <div className="time-values">
                                        {/* Helper to check if time is next day relative to card date */}
                                        {(() => {
                                            const isNextDay = (timeStr: string | null, baseDateStr: string) => {
                                                if (!timeStr) return false;
                                                // If event is > 24h from base, or just explicitly next calendar day?
                                                // Simple check: getDate() difference.
                                                const eventDate = new Date(timeStr);
                                                const baseDate = new Date(baseDateStr);
                                                return eventDate.getDate() !== baseDate.getDate();
                                            };

                                            // Handle Always Up/Down
                                            // Note: We need to cast 'day.moon' to any if TS complains about missing alwaysUp prop, 
                                            // or better, update the type definition. 
                                            // For now assuming passed data has it.
                                            const moonData = day.moon as any;
                                            if (moonData.alwaysUp) return <span className="text-yellow-300">Always Up</span>;
                                            if (moonData.alwaysDown) return <span className="text-gray-500">Always Down</span>;

                                            return (
                                                <>
                                                    <span>Rise <strong>{formatTime(day.moon.rise)}{isNextDay(day.moon.rise, day.date) ? <small className="text-xs text-gray-400 ml-1">(+1)</small> : ''}</strong></span>
                                                    <span className="divider">│</span>
                                                    <span>Set <strong>{formatTime(day.moon.set)}{isNextDay(day.moon.set, day.date) ? <small className="text-xs text-gray-400 ml-1">(+1)</small> : ''}</strong></span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="info-box">
                            💡 {today.moon.fraction > 0.7 ? "Bright moon, poor for Deep Sky." : today.moon.fraction < 0.2 ? "Dark moon, excellent for Deep Sky!" : "Moon conditions are moderate."}
                        </div>
                    </div>
                )}

                {/* Sun Tab */}
                {activeTab === 'sun' && (
                    <div className="animate-fade-in">
                        <div className="sun-header">
                            <div className="sun-visual">
                                <div className="sun-corona"></div>
                                <div className="sun-outer-rays">
                                    {[...Array(12)].map((_, i) => <div key={i} className="sun-outer-ray"></div>)}
                                </div>
                                <div className="sun-rays">
                                    {[...Array(8)].map((_, i) => <div key={i} className="sun-ray"></div>)}
                                </div>
                                <div className="sun-sphere"></div>
                            </div>
                            <h3>Sunrise & Sunset</h3>
                        </div>

                        <div className="time-table">
                            {data.map((day, idx) => (
                                <div key={idx} className="time-row">
                                    <span className="date-label">{formatDate(day.date, idx)}</span>
                                    <div className="time-values">
                                        <span>Rise <strong>{formatTime(day.sun.sunrise)}</strong></span>
                                        <span className="divider">│</span>
                                        <span>Set <strong>{formatTime(day.sun.sunset)}</strong></span>
                                    </div>
                                    <p className="observable">Night Duration: {calculateDuration(day.sun.observableHours)}</p>
                                </div>
                            ))}
                        </div>

                        <div className="info-box">
                            💡 Best visibility: 1~2 hours after sunset.
                        </div>
                    </div>
                )}

                {/* Best Time Tab */}
                {activeTab === 'optimal' && (
                    <div className="animate-fade-in">
                        <div className="optimal-header">
                            <h3>Optimal Observation Times</h3>
                            <p className="text-gray-400 text-xs text-center mb-4">Calculated based on Moon/Sun cycles</p>
                        </div>

                        <div className="optimal-days">
                            {data.map((day, idx) => {
                                const nextDay = data[idx + 1];
                                const windows = calculateObservationWindows(day, nextDay);

                                // Calculate total duration
                                const totalMins = windows.reduce((acc, w) => acc + w.duration, 0);
                                const totalTimeStr = totalMins > 0 ? formatDurationMins(totalMins) : 'No dark time';

                                // Calculate timeline markers relative to sunset -> next sunrise
                                // Simplified timeline visualization for the card

                                return (
                                    <div key={idx} className="optimal-day">
                                        <div className="day-header">
                                            <span className="day-label">{formatDate(day.date, idx)}</span>
                                            <span className="total-time">{totalMins > 0 ? `Total ${totalTimeStr}` : totalTimeStr}</span>
                                        </div>

                                        {windows.length > 0 ? (
                                            <div className="observation-windows">
                                                {windows.map((w, wIdx) => (
                                                    <div key={wIdx} className={`obs-window ${w.quality}`}>
                                                        <div className="window-header">
                                                            <span className="time-icon text-lg mr-2">{w.icon}</span>
                                                            <span className="time-range flex-1 font-bold text-white">{minutesToTime(w.start)} - {minutesToTime(w.end)}</span>
                                                            <span className="duration text-xs bg-white/10 px-2 py-1 rounded">{formatDurationMins(w.duration)}</span>
                                                        </div>
                                                        <div className="window-info flex justify-between items-center mb-2">
                                                            <span className="condition text-xs text-gray-400">{w.condition}</span>
                                                            <span className={`quality-badge ${w.quality}`}>
                                                                {w.quality === 'excellent' ? '★★★ Excellent' : w.quality === 'good' ? '★★☆ Good' : '★☆☆ Fair'}
                                                            </span>
                                                        </div>
                                                        <div className="window-bar h-1.5 bg-white/10 rounded overflow-hidden mb-2">
                                                            <div className={`bar-fill h-full quality-fill-${w.quality}`} style={{ width: `${w.score}%` }}></div>
                                                        </div>
                                                        <p className="window-tip text-xs text-gray-400 italic">{w.tip}</p>
                                                    </div>
                                                ))}

                                                {/* Recommendation logic */}
                                                {windows.length > 0 && (
                                                    <div className="recommendation mt-3 p-3 bg-green-900/20 border-l-2 border-green-500 rounded text-xs text-green-400">
                                                        🎯 <strong>Recommendation:</strong> Best time is after {minutesToTime(windows.reduce((p, c) => c.score > p.score ? c : p).start)}.
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="no-observation text-center py-6 text-gray-400">
                                                <div className="text-3xl mb-2">🌕</div>
                                                <h4 className="text-white text-sm font-bold">Unsuitable for Deep Sky</h4>
                                                <p className="text-xs mt-1">Moon is too bright or always up.<br />Try planetary observation.</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="info-box mt-4">
                            <ul className="text-xs list-disc pl-4 space-y-1">
                                <li>Starts 1h after sunset (stabilization)</li>
                                <li>Ends 1h before sunrise</li>
                                <li>Avoids bright moon times</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MoonPhase;
