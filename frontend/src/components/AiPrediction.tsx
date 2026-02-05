import React, { useState } from 'react';
import { Sparkles, Bot, Clock, Info } from 'lucide-react';
import ModelInfoModal from './ModelInfoModal';
import { predictSeeing } from '../utils/aiService';
import type { ForecastItem } from '../types/weather';
import TimeSlider from './TimeSlider';
import PredictionCard from './PredictionCard';

interface Props {
    forecastList: ForecastItem[];
    timezone?: string;
}

const AiPrediction: React.FC<Props> = ({ forecastList, timezone = 'UTC' }) => {
    const [prediction, setPrediction] = useState<{ probability: number; comment: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showInfo, setShowInfo] = useState(false);

    // Limit to next 24 hours (approx 8 items x 3h)
    const availableForecasts = forecastList.slice(0, 9);
    const selectedForecast = availableForecasts[selectedIndex] || availableForecasts[0];

    const handlePredict = () => {
        if (!selectedForecast) return;

        setLoading(true);
        setPrediction(null); // Clear previous result to trigger animation

        // Simulate AI "Processing" time
        setTimeout(() => {
            const result = predictSeeing({
                seeing: selectedForecast.scores.seeing,
                transparency: selectedForecast.scores.transparency,
                cloudCover: selectedForecast.scores.cloudCover,
                windSpeed: selectedForecast.wind10m.speed,
                humidity: selectedForecast.rh2m
            });

            // Override with USP model data if available
            if (selectedForecast.usp) {
                result.probability = selectedForecast.usp.score * 10;

                // Enhanced comments based on USP insights
                if (selectedForecast.usp.score >= 8.5) {
                    result.comment = "Ultra-precision seeing detected! Perfect for high-resolution planetary imaging and close double stars.";
                } else if (selectedForecast.usp.score >= 7.0) {
                    result.comment = "Stable air profile. Excellent for most observation; Fried parameter suggests very sharp views.";
                } else if (selectedForecast.usp.score >= 5.5) {
                    result.comment = "Moderate turbulence in boundary layers. Good for general observation but may lack fine planetary detail.";
                }
            }

            setPrediction(result);
            setLoading(false);

            // Play Sound
            try {
                const audio = new Audio('/magic-chime.mp3');
                audio.volume = 0.5;
                audio.play().catch(e => console.log("Audio play failed:", e));
            } catch (e) {
                console.error("Audio error", e);
            }
        }, 1500);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedIndex(parseInt(e.target.value));
        setPrediction(null); // Reset prediction on time change
    };

    // State for live clock
    const [now, setNow] = useState<Date>(new Date());

    // Effect to update time every second
    React.useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            timeZone: timezone,
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    const formatTargetTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            timeZone: timezone,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Derived values
    const currentTimeLabel = formatTime(now);

    // Calculate Target Time: Now + (Index * 3 hours)
    const targetTime = new Date(now.getTime() + selectedIndex * 3 * 60 * 60 * 1000);
    const targetTimeLabel = formatTargetTime(targetTime);

    // Prepare details for the card
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
                                <span className="text-[10px] text-cyan-300 font-black uppercase tracking-widest whitespace-nowrap">USP-Model v1.0</span>
                                <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-purple-500/30 shadow-lg">
                    <Clock className="w-4 h-4 text-purple-300" />
                    <span className="text-lg font-bold text-white tracking-wide font-mono">
                        {targetTimeLabel}
                    </span>
                </div>
            </div>

            {/* Extracted Slider Component */}
            <TimeSlider
                selectedIndex={selectedIndex}
                maxIndex={availableForecasts.length - 1}
                onChange={handleTimeChange}
                currentTimeLabel={currentTimeLabel}
                targetTimeLabel={targetTimeLabel}
            />

            {/* Action Area */}
            {!prediction && !loading && (
                <div className="text-center py-2 animate-fade-in">
                    <button
                        onClick={handlePredict}
                        className="bg-white text-purple-900 hover:bg-gray-100 hover:scale-105 px-8 py-3 rounded-full font-bold flex items-center gap-2 mx-auto transition-all shadow-lg shadow-purple-900/50"
                    >
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        Analyze This Time
                    </button>
                    <p className="text-xs text-center text-purple-300 mt-3 opacity-70">
                        Analyzing weather stability & astronomical conditions...
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
