import React, { useState } from 'react';
import './MoonPhase.css';
import { type AstronomyDay } from '../types/weather';
import { getPhaseDef, formatDate, formatTime, calculateDuration, getBestTimeData } from '../utils/astronomyUtils';

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
                                <div className="moon-glow" style={{ opacity: today.moon.fraction }}></div>
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
                                        <span>Rise <strong>{formatTime(day.moon.rise)}</strong></span>
                                        <span className="divider">│</span>
                                        <span>Set <strong>{formatTime(day.moon.set)}</strong></span>
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
                        <div className="optimal-header text-center">
                            <h3>Optimal Observation Times</h3>
                        </div>

                        <div className="optimal-list">
                            {data.map((day, idx) => {
                                const best = getBestTimeData(day);
                                if (!best) return null;
                                return (
                                    <div key={idx} className="optimal-row" style={{ borderLeftColor: best.quality === 'Excellent' ? '#27ae60' : best.quality === 'Good' ? '#3498db' : '#f39c12' }}>
                                        <span className="date-label">{formatDate(day.date, idx)}</span>
                                        <div className="optimal-info">
                                            <span className="time-range">⏰ <strong>{best.start} - {best.end}</strong></span>
                                            <span className={`quality-badge ${best.badgeClass}`}>{best.quality}</span>
                                        </div>
                                        <div className="quality-bar">
                                            <div className="bar-fill" style={{ width: `${best.score}%`, background: best.quality === 'Excellent' ? '#27ae60' : best.quality === 'Good' ? '#3498db' : '#f39c12' }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="info-box">
                            💡 Calculated based on sunset and moon brightness.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MoonPhase;
