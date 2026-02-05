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
        usp?: {
            seeing: number;
            score: number;
            confidence: number;
            details: {
                r0: number;
                stability: string;
                jetStream: string;
            };
        };
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
                <p className="text-purple-200 animate-pulse font-medium">Consulting USP-Model v1.0...</p>
            </div>
        );
    }

    if (!prediction) return null;

    const usp = details?.usp;

    return (
        <div className="bg-black/30 backdrop-blur-sm p-5 rounded-xl animate-scale-in text-center border border-white/10">
            <div className="text-xs text-purple-300 uppercase tracking-widest mb-1 font-bold">
                {usp ? `USP Score (Confidence ${usp.confidence}%)` : 'Observation Probability'}
            </div>

            <div className="flex items-center justify-center gap-2 mb-2">
                {hasPrev && <ChevronLeft className="w-4 h-4 text-white/20" />}
                <div className={`text-5xl font-extrabold drop-shadow-lg ${(usp ? (usp.score * 10) : prediction.probability) > 70
                        ? 'text-green-400'
                        : (usp ? (usp.score * 10) : prediction.probability) > 40
                            ? 'text-yellow-400'
                            : 'text-red-400'
                    }`}>
                    {usp ? usp.score : prediction.probability}
                    <span className="text-2xl font-black">{usp ? '/10' : '%'}</span>
                </div>
                {hasNext && <ChevronRight className="w-4 h-4 text-white/20" />}
            </div>

            <p className="text-lg text-white font-medium leading-relaxed mb-4">"{prediction.comment}"</p>

            {details && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-left bg-purple-900/30 p-3 rounded-lg mx-auto max-w-sm">
                    <div className="text-purple-200">See (USP): <span className="text-cyan-300 font-black">{usp ? usp.seeing : details.seeing}"</span></div>
                    <div className="text-purple-200">Fried (r₀): <span className="text-white font-bold">{usp ? usp.details.r0 : '-'} cm</span></div>
                    <div className="text-purple-200">Stability: <span className="text-white font-bold">{usp ? usp.details.stability : 'N/A'}</span></div>
                    <div className="text-purple-200">Jet Stream: <span className="text-white font-bold">{usp ? usp.details.jetStream : 'N/A'}</span></div>

                    <div className="col-span-2 border-t border-white/10 mt-1 pt-1 opacity-60"></div>

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
