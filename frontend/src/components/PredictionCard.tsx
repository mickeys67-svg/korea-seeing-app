import React from 'react';
import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';

interface PredictionResultProps {
    prediction: {
        probability: number;
        comment: string;
    } | null;
    loading: boolean;
    onClose: () => void;
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
            <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)] mx-auto mb-3" />
                <p className="text-sm text-[var(--text-secondary)] font-data animate-pulse">
                    Analyzing atmospheric layers...
                </p>
            </div>
        );
    }

    if (!prediction) return null;

    const usp = details?.usp;
    const displayValue = usp ? usp.score : prediction.probability;
    const displayMax = usp ? '/10' : '%';

    const getValueColor = (val: number, isUsp: boolean): string => {
        const threshold = isUsp ? val * 10 : val;
        if (threshold > 70) return 'var(--seeing-exceptional)';
        if (threshold > 40) return 'var(--seeing-fair)';
        return 'var(--seeing-very-poor)';
    };

    const valueColor = getValueColor(displayValue, !!usp);

    return (
        <div className="glass-card-inner p-5 animate-scale-in text-center">
            <div className="text-xs font-data uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-3 font-medium">
                {usp ? `Warp Score (${usp.confidence}% confidence)` : 'Observation Probability'}
            </div>

            <div className="flex items-center justify-center gap-3 mb-3">
                {hasPrev && <ChevronLeft className="w-4 h-4 text-[var(--text-tertiary)]" />}
                <div className="flex items-baseline">
                    <span className="text-5xl font-data font-bold" style={{ color: valueColor }}>
                        {displayValue}
                    </span>
                    <span className="text-lg font-data font-bold text-[var(--text-tertiary)]">{displayMax}</span>
                </div>
                {hasNext && <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />}
            </div>

            <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed mb-5 max-w-sm mx-auto">
                {prediction.comment}
            </p>

            {details && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm text-left bg-[var(--bg-surface)] p-4 rounded-xl mx-auto max-w-sm border border-[var(--glass-border)]">
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">Seeing (USP)</span>
                        <span className="font-data font-bold text-[var(--cyan)]">{usp ? usp.seeing : details.seeing}"</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">Fried (r&#8320;)</span>
                        <span className="font-data font-bold text-[var(--text-primary)]">{usp ? usp.details.r0 : '-'} cm</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">Stability</span>
                        <span className="font-data font-bold text-[var(--text-primary)]">{usp ? usp.details.stability : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">Jet Stream</span>
                        <span className="font-data font-bold text-[var(--text-primary)]">{usp ? usp.details.jetStream : 'N/A'}</span>
                    </div>
                    <div className="col-span-2 h-px bg-[var(--glass-border)] my-1" />
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">Cloud</span>
                        <span className="font-data font-bold text-[var(--text-primary)]">{details.cloudCover}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">Wind</span>
                        <span className="font-data font-bold text-[var(--text-primary)]">{details.windSpeed}m/s</span>
                    </div>
                </div>
            )}

            <button
                onClick={onClose}
                className="mt-5 text-sm text-[var(--warp-purple)] hover:text-[var(--text-primary)] transition-colors font-medium"
            >
                Warp to another time
            </button>
        </div>
    );
};

export default PredictionCard;
