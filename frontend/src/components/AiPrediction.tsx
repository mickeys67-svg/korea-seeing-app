import React, { useState } from 'react';
import { Sparkles, Bot } from 'lucide-react';
import { predictSeeing } from '../utils/aiService';

interface Props {
    weather: {
        seeing: number;
        transparency: number;
        cloudCover: number;
        wind10m: { speed: number };
        rh2m: number;
    };
}

const AiPrediction: React.FC<Props> = ({ weather }) => {
    const [prediction, setPrediction] = useState<{ probability: number; comment: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const handlePredict = () => {
        setLoading(true);
        // Simulate AI "Processing" time
        setTimeout(() => {
            const result = predictSeeing({
                seeing: weather.seeing,
                transparency: weather.transparency,
                cloudCover: weather.cloudCover,
                windSpeed: weather.wind10m.speed,
                humidity: weather.rh2m
            });
            setPrediction(result);
            setLoading(false);
        }, 1500);
    };

    return (
        <div className="w-full bg-gradient-to-r from-purple-900 to-indigo-900 p-6 rounded-2xl mt-6 shadow-xl border border-purple-500/30">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Bot className="w-6 h-6 text-purple-300" />
                    AI Seeing Predictor
                </h3>
            </div>

            {!prediction && !loading && (
                <div className="text-center py-4">
                    <p className="text-gray-300 mb-4">Ask our AI to analyze current atmospheric stability.</p>
                    <button
                        onClick={handlePredict}
                        className="bg-white text-purple-900 hover:bg-gray-100 px-6 py-3 rounded-full font-bold flex items-center gap-2 mx-auto transition-all shadow-lg hover:scale-105"
                    >
                        <Sparkles className="w-5 h-5" />
                        Analyze Conditions
                    </button>
                </div>
            )}

            {loading && (
                <div className="text-center py-6">
                    <div className="animate-spin w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-purple-200 animate-pulse">Analyzing Atmosphere...</p>
                </div>
            )}

            {prediction && (
                <div className="bg-black/20 p-4 rounded-xl animate-fade-in text-center">
                    <div className="text-sm text-purple-300 uppercase tracking-widest mb-1">Observation Probability</div>
                    <div className={`text-4xl font-extrabold mb-2 ${prediction.probability > 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {prediction.probability}%
                    </div>
                    <p className="text-lg text-white font-medium">"{prediction.comment}"</p>

                    <button
                        onClick={() => setPrediction(null)}
                        className="mt-4 text-xs text-purple-400 hover:text-white underline"
                    >
                        Reset analysis
                    </button>
                </div>
            )}
        </div>
    );
};

export default AiPrediction;
