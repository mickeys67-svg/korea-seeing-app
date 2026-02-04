import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface PredictionResultProps {
    prediction: {
        probability: number;
        comment: string;
    } | null;
    loading: boolean;
    onClose: () => void;
    // Data for the grid details
    details?: {
        seeing: number;
        transparency: number;
        cloudCover: number;
        windSpeed: number;
    };
    hasPrev: boolean;
    hasNext: boolean;
}

const PredictionCard: React.FC<PredictionResultProps> = ({
    prediction,
    loading,
    onClose,
    details,
    hasPrev,
    hasNext
}) => {
    if (loading) {
        return (
            <div className="text-center py-6">
                <div className="animate-spin w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-purple-200 animate-pulse font-medium">Consulting AI Oracle...</p>
            </div>
        );
    }

    if (!prediction) return null;

    return (
        <div className="bg-black/30 backdrop-blur-sm p-5 rounded-xl animate-scale-in text-center border border-white/10">
            <div className="text-xs text-purple-300 uppercase tracking-widest mb-1 font-bold">Observation Probability</div>

            <div className="flex items-center justify-center gap-2 mb-2">
                {hasPrev && <ChevronLeft className="w-4 h-4 text-white/20" />}
                <div className={`text-5xl font-extrabold drop-shadow-lg ${prediction.probability > 70 ? 'text-green-400' : prediction.probability > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {prediction.probability}%
                </div>
                {hasNext && <ChevronRight className="w-4 h-4 text-white/20" />}
            </div>

            <p className="text-lg text-white font-medium leading-relaxed mb-4">"{prediction.comment}"</p>

            {details && (
                <div className="grid grid-cols-2 gap-2 text-xs text-left bg-purple-900/30 p-3 rounded-lg mx-auto max-w-xs">
                    <div className="text-purple-200">See: <span className="text-white font-bold">{details.seeing}</span></div>
                    <div className="text-purple-200">Trans: <span className="text-white font-bold">{details.transparency}</span></div>
                    <div className="text-purple-200">Cloud: <span className="text-white font-bold">{details.cloudCover}</span></div>
                    <div className="text-purple-200">Wind: <span className="text-white font-bold">{details.windSpeed}m/s</span></div>
                </div>
            )}

            <button
                onClick={onClose}
                className="mt-4 text-xs text-purple-400 hover:text-white underline decoration-dashed"
            >
                Try another time
            </button>
        </div>
    );
};

export default PredictionCard;
