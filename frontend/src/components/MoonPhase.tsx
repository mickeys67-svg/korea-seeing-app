import React, { useState } from 'react';
import './MoonPhase.css';
import { type AstronomyDay } from '../types/weather';

interface MoonPhaseProps {
    data: AstronomyDay[];
}

const MoonPhase: React.FC<MoonPhaseProps> = ({ data }) => {
    const [activeTab, setActiveTab] = useState<'moon' | 'sun' | 'optimal'>('moon');

    // Use current day data (first element)
    const today = data && data.length > 0 ? data[0] : null;

    // Helper to map API phase (0-1) to logic and name
    const getPhaseDef = (phase: number) => {
        // SunCalc phase: 0=New, 0.25=First Quarter, 0.5=Full, 0.75=Last Quarter
        if (phase === 0 || phase === 1) return { name: 'New Moon', class: 'moon-phase-new', icon: '🌑' };
        if (phase < 0.25) return { name: 'Waxing Crescent', class: 'moon-phase-waxing-crescent', icon: '🌒' };
        if (phase === 0.25) return { name: 'First Quarter', class: 'moon-phase-first-quarter', icon: '🌓' };
        if (phase < 0.5) return { name: 'Waxing Gibbous', class: 'moon-phase-waxing-gibbous', icon: '🌔' };
        if (phase === 0.5) return { name: 'Full Moon', class: 'moon-phase-full', icon: '🌕' };
        if (phase < 0.75) return { name: 'Waning Gibbous', class: 'moon-phase-waning-gibbous', icon: '🌖' };
        if (phase === 0.75) return { name: 'Last Quarter', class: 'moon-phase-last-quarter', icon: '🌗' };
        return { name: 'Waning Crescent', class: 'moon-phase-waning-crescent', icon: '🌘' };
    };

    const currentPhase = today ? getPhaseDef(today.moon.phase) : { name: '', class: '', icon: '' };


    // Format Helpers
    const formatDate = (dateStr: string, index: number) => {
        const d = new Date(dateStr);
        const mm = d.getMonth() + 1;
        const dd = d.getDate();
        const label = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : 'Day after';
        return `${label} (${mm}/${dd})`;
    };

    const formatTime = (timeStr: string | null) => {
        if (!timeStr) return '--:--';
        return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const calculateDuration = (hrs: number) => {
        const h = Math.floor(hrs);
        const m = Math.round((hrs - h) * 60);
        return `${h}h ${m}m`;
    };

    // Best Time Logic
    const getBestTimeData = (day: AstronomyDay) => {
        if (!day.sun.sunset) return null;

        const sunsetDate = new Date(day.sun.sunset);
        const start = new Date(sunsetDate);
        start.setHours(start.getHours() + 1);

        const end = new Date(sunsetDate);
        let duration = 3;

        if (day.moon.fraction > 0.7) {
            duration = 1.5;
        } else if (day.moon.fraction > 0.3) {
            duration = 2.5;
        }

        end.setMinutes(end.getMinutes() + (duration * 60));

        // Score logic (0-100)
        let score = 50;
        if (day.moon.fraction < 0.1) score = 100;
        else if (day.moon.fraction < 0.3) score = 80;
        else if (day.moon.fraction < 0.6) score = 60;
        else score = 30;

        let quality = 'Fair';
        let badgeClass = 'fair';
        if (score >= 80) { quality = 'Excellent'; badgeClass = 'excellent'; }
        else if (score >= 60) { quality = 'Good'; badgeClass = 'good'; }

        return {
            start: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            end: end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            score,
            quality,
            badgeClass
        };
    };

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
