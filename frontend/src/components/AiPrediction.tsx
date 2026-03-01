import React, { useState } from 'react';
import { Sparkles, Rocket, Info, Zap } from 'lucide-react';
import ModelInfoModal from './ModelInfoModal';
import { predictSeeing } from '../utils/aiService';
import type { ForecastItem } from '../types/weather';
import TimeSlider from './TimeSlider';
import PredictionCard from './PredictionCard';
import LiveClock from './LiveClock';
import TargetPredictionGrid from './TargetPredictionGrid';
import useI18n from '../hooks/useI18n';

interface Props {
    forecastList: ForecastItem[];
    timezone?: string;
    aiSummary?: string | null;
    moonFraction?: number;
}

const AiPrediction: React.FC<Props> = ({ forecastList, timezone, aiSummary, moonFraction = 0.5 }) => {
    const t = useI18n();
    const resolvedTz = (timezone && timezone !== 'UTC' && timezone !== 'GMT')
        ? timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [prediction, setPrediction] = useState<{ probability: number; comment: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showInfo, setShowInfo] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState(t.aiPrediction.warpMessages[0]);

    const availableForecasts = forecastList.slice(0, 9);
    const selectedForecast = availableForecasts[selectedIndex] || availableForecasts[0];

    const handlePredict = () => {
        if (!selectedForecast) return;

        setLoading(true);
        setPrediction(null);
        setLoadingMsg(t.aiPrediction.warpMessages[Math.floor(Math.random() * t.aiPrediction.warpMessages.length)]);

        setTimeout(() => {
            const result = predictSeeing({
                seeing: selectedForecast.scores.seeing,
                transparency: selectedForecast.scores.transparency,
                cloudCover: selectedForecast.scores.cloudCover,
                windSpeed: selectedForecast.wind10m.speed,
                humidity: selectedForecast.rh2m
            });

            if (selectedForecast.usp) {
                result.probability = selectedForecast.usp.score * 10;

                if (selectedForecast.usp.score >= 8.0) {
                    result.comment = t.aiPrediction.uspComments.exceptional;
                } else if (selectedForecast.usp.score >= 6.5) {
                    result.comment = t.aiPrediction.uspComments.good;
                } else {
                    result.comment = t.aiPrediction.uspComments.poor;
                }
            }

            setPrediction(result);
            setLoading(false);

            try {
                const audio = new Audio('/magic-chime.mp3');
                audio.volume = 0.4;
                audio.play().catch(() => { /* autoplay blocked by browser policy */ });
            } catch (e) { console.warn('[Warp] Audio init failed:', e); }
        }, 1200);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedIndex(parseInt(e.target.value));
        setPrediction(null);
    };

    const formatTargetTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', {
            timeZone: resolvedTz,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const targetTimeLabel = selectedForecast ? formatTargetTime(selectedForecast.time) : '...';

    const predictionDetails = selectedForecast ? {
        seeing: selectedForecast.scores.seeing,
        transparency: selectedForecast.scores.transparency,
        cloudCover: selectedForecast.scores.cloudCover,
        windSpeed: selectedForecast.wind10m.speed,
        usp: selectedForecast.usp
    } : undefined;

    if (!selectedForecast) return null;

    return (
        <div className="glass-card w-full p-6 sm:p-8 mt-6 animate-fade-in-up delay-3 relative overflow-hidden" style={{ animationFillMode: 'backwards' }}>
            {/* Warp glow effects */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none opacity-30"
                style={{ background: 'radial-gradient(circle, var(--warp-purple), transparent)' }} />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl -ml-12 -mb-12 pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(circle, var(--warp-pink), transparent)' }} />

            {/* Speed lines decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute h-[1px] opacity-0"
                        style={{
                            top: `${20 + i * 30}%`,
                            left: 0,
                            right: 0,
                            background: `linear-gradient(90deg, transparent, var(--warp-purple), transparent)`,
                            animation: `warpSpeedLines ${3 + i}s ease-in-out ${i * 2}s infinite`,
                        }}
                    />
                ))}
            </div>

            {/* AI Summary */}
            {aiSummary && (
                <div className="mb-4 relative z-10">
                    <div className="glass-card-inner p-5 flex gap-3 items-start border-l-2 border-[var(--warp-purple)]">
                        <Zap className="w-5 h-5 text-[var(--warp-purple)] shrink-0 mt-0.5" />
                        <div>
                            <span className="text-sm font-data uppercase tracking-[0.15em] text-[var(--warp-purple)] block mb-1.5 font-bold">{t.aiPrediction.warpInsight}</span>
                            <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed">
                                {aiSummary}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Target Suitability Grid — always visible, updates with time slider */}
            <TargetPredictionGrid
                forecast={selectedForecast}
                moonFraction={moonFraction}
            />

            {/* Header */}
            <div className="flex flex-col items-center mb-6 relative z-10">
                <button
                    onClick={() => setShowInfo(true)}
                    className="flex items-center gap-3 mb-3 group px-5 py-2.5 rounded-2xl hover:bg-[var(--bg-surface)] transition-colors"
                    title="Model details"
                >
                    <div className="p-2.5 rounded-xl border border-[var(--glass-border)] group-hover:border-[var(--warp-purple)] transition-all animate-warp-pulse"
                        style={{ background: 'color-mix(in srgb, var(--warp-purple) 12%, transparent)' }}>
                        <Rocket className="w-6 h-6 text-[var(--warp-purple)]" />
                    </div>
                    <div className="flex flex-col items-start">
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-xl font-bold text-gradient-warp">
                                WARP AI
                            </h3>
                            <Info className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--warp-purple)] transition-colors" />
                        </div>
                        <span className="text-xs font-data text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
                            {t.aiPrediction.ensembleVersion}
                        </span>
                    </div>
                </button>

                <div className="flex flex-col items-center gap-2">
                    <LiveClock timezone={resolvedTz} />
                    {selectedForecast.usp && (
                        <div className="flex items-center gap-1.5 text-xs font-data text-[var(--text-tertiary)]">
                            <span>{t.common.confidence}:</span>
                            <span className="font-bold" style={{ color: selectedForecast.usp.confidence > 80 ? 'var(--seeing-exceptional)' : 'var(--seeing-fair)' }}>
                                {selectedForecast.usp.confidence}%
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Time Slider */}
            <TimeSlider
                selectedIndex={selectedIndex}
                maxIndex={availableForecasts.length - 1}
                onChange={handleTimeChange}
                startLabel="Now"
                targetTimeLabel={targetTimeLabel}
            />

            {/* Warp Scan Button */}
            {!prediction && !loading && (
                <div className="text-center py-3 animate-fade-in relative z-10">
                    <button
                        onClick={handlePredict}
                        className="relative text-white px-8 py-3.5 rounded-full font-semibold text-sm flex items-center gap-2.5 mx-auto transition-all hover:scale-105 active:scale-95 overflow-hidden group"
                        style={{
                            background: 'linear-gradient(135deg, var(--warp-purple), var(--accent-dim), var(--warp-pink))',
                            boxShadow: '0 4px 24px var(--warp-glow), 0 0 0 1px rgba(167, 139, 250, 0.2)',
                        }}
                    >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'linear-gradient(135deg, var(--warp-pink), var(--accent-dim), var(--warp-purple))' }} />
                        <Rocket className="w-5 h-5 relative z-10" />
                        <span className="relative z-10">{t.aiPrediction.warpScan}</span>
                        <Sparkles className="w-4 h-4 relative z-10 opacity-70" />
                    </button>
                    <p className="text-xs text-[var(--text-tertiary)] mt-3 font-data uppercase tracking-[0.12em]">
                        GFS / ECMWF / 7Timer Ensemble
                    </p>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-8 relative z-10">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full border-2 border-[var(--warp-purple)]/30 animate-spin"
                            style={{ animationDuration: '3s' }} />
                        <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-[var(--warp-pink)] animate-spin"
                            style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Rocket className="w-6 h-6 text-[var(--warp-purple)] animate-pulse" />
                        </div>
                    </div>
                    <p className="text-sm text-[var(--warp-purple)] font-data animate-pulse font-medium">
                        {loadingMsg}
                    </p>
                </div>
            )}

            {/* Prediction Result */}
            {!loading && (
                <PredictionCard
                    prediction={prediction}
                    loading={false}
                    onClose={() => setPrediction(null)}
                    details={predictionDetails}
                    hasPrev={selectedIndex > 0}
                    hasNext={selectedIndex < availableForecasts.length - 1}
                />
            )}

            <ModelInfoModal
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
            />
        </div>
    );
};

export default AiPrediction;
