import React, { useState } from 'react';
import { Sparkles, Bot, Info } from 'lucide-react';
import ModelInfoModal from './ModelInfoModal';
import { predictSeeing } from '../utils/aiService';
import type { ForecastItem } from '../types/weather';
import TimeSlider from './TimeSlider';
import PredictionCard from './PredictionCard';
import LiveClock from './LiveClock';

interface Props {
    forecastList: ForecastItem[];
    timezone?: string;
    aiSummary?: string | null;
}

const AiPrediction: React.FC<Props> = ({ forecastList, timezone = 'UTC', aiSummary }) => {
    const [prediction, setPrediction] = useState<{ probability: number; comment: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showInfo, setShowInfo] = useState(false);

    // Limit to next 24 hours
    const availableForecasts = forecastList.slice(0, 9);
    const selectedForecast = availableForecasts[selectedIndex] || availableForecasts[0];

    const handlePredict = () => {
        if (!selectedForecast) return;

        setLoading(true);
        setPrediction(null);

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

                // Active Logic based on multiple factors
                if (selectedForecast.usp.score >= 8.0) {
                    result.comment = "Exceptional atmospheric stability. Perfect for high-resolution planetary imaging.";
                } else if (selectedForecast.usp.score >= 6.5) {
                    result.comment = "Steady air detected. Ideal for deep-sky observation and most imaging targets.";
                } else {
                    result.comment = "Boundary layer turbulence detected. Low-power wide-field observation recommended.";
                }
            }

            setPrediction(result);
            setLoading(false);

            try {
                const audio = new Audio('/magic-chime.mp3');
                audio.volume = 0.4;
                audio.play().catch(() => { });
            } catch (e) { }
        }, 1200);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedIndex(parseInt(e.target.value));
        setPrediction(null);
    };

    const formatTargetTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', {
            timeZone: timezone,
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
        <div className="w-full bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 p-6 rounded-3xl mt-6 shadow-2xl border border-purple-400/50 transition-all duration-300 relative overflow-hidden group">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

            {/* AI Summary Header (Global Insight) */}
            {aiSummary && (
                <div className="mb-6 animate-fade-in">
                    <div className="bg-black/30 backdrop-blur-md p-4 rounded-2xl border border-cyan-500/30 flex gap-4 items-start">
                        <div className="bg-cyan-500/20 p-2 rounded-xl border border-cyan-400/30 shrink-0">
                            <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-1">Ensemble AI Insight</span>
                            <p className="text-sm text-gray-200 indent-0 italic leading-relaxed">
                                "{aiSummary}"
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col items-center justify-center mb-8 relative z-10">
                <div className="flex items-center gap-3 mb-3">
                    <button
                        onClick={() => setShowInfo(true)}
                        className="flex items-center gap-4 hover:scale-105 transition-all cursor-help group/title py-2 px-4 rounded-2xl hover:bg-white/5"
                        title="Click for Model Explanation"
                    >
                        <div className="bg-white/10 p-3 rounded-full backdrop-blur-md shadow-inner border border-white/20 group-hover/title:border-cyan-400/50 transition-colors shrink-0">
                            <Bot className="w-10 h-10 text-cyan-300 drop-shadow-[0_0_10px_rgba(103,232,249,0.5)]" />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                            <div className="flex items-center gap-2 overflow-visible">
                                <h3 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300 italic animate-warp-glow leading-tight pb-1 pr-4">
                                    Warp AI
                                </h3>
                                <Info className="w-5 h-5 text-purple-300/50 group-hover/title:text-cyan-300 transition-colors shrink-0" />
                            </div>
                            <div className="flex items-center gap-1.5 -mt-1 ml-1 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-md">
                                <span className="text-[10px] text-cyan-300 font-black uppercase tracking-widest whitespace-nowrap">USP Ensemble v2.0</span>
                                <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                    </button>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <LiveClock timezone={timezone} />
                    {selectedForecast.usp && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-purple-300/70 uppercase tracking-tighter">
                            <span>Relay Confidence:</span>
                            <span className={selectedForecast.usp.confidence > 80 ? 'text-green-400' : 'text-yellow-400'}>
                                {selectedForecast.usp.confidence}%
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Extracted Slider Component */}
            <TimeSlider
                selectedIndex={selectedIndex}
                maxIndex={availableForecasts.length - 1}
                onChange={handleTimeChange}
                startLabel="Now"
                targetTimeLabel={targetTimeLabel}
            />

            {/* Action Area */}
            {!prediction && !loading && (
                <div className="text-center py-2 animate-fade-in group/btn">
                    <button
                        onClick={handlePredict}
                        className="bg-white text-purple-900 hover:bg-cyan-50 hover:scale-105 active:scale-95 px-8 py-3 rounded-full font-bold flex items-center gap-2 mx-auto transition-all shadow-lg shadow-purple-900/50 border-b-4 border-purple-200"
                    >
                        <Sparkles className="w-5 h-5 text-purple-600 group-hover/btn:animate-spin" />
                        Active Scan
                    </button>
                    <p className="text-[10px] text-center text-purple-300 mt-3 opacity-70 font-mono tracking-widest">
                        INTEGRATING GFS / ECMWF / 7TIMER DATASTREAM
                    </p>
                </div>
            )}

            {/* Extracted Card Component */}
            <PredictionCard
                prediction={prediction}
                loading={loading}
                onClose={() => setPrediction(null)}
                details={predictionDetails}
                hasPrev={selectedIndex > 0}
                hasNext={selectedIndex < availableForecasts.length - 1}
            />

            {/* Model Info Modal */}
            <ModelInfoModal
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
            />
        </div>
    );
};

export default AiPrediction;
