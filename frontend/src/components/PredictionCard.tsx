import React from 'react';
import { Loader2, ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import useI18n from '../hooks/useI18n';

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
    onPrev?: () => void;
    onNext?: () => void;
    targetTime?: string;
}

const PredictionCard: React.FC<PredictionResultProps> = ({
    prediction,
    loading,
    onClose,
    details,
    hasPrev,
    hasNext,
    onPrev,
    onNext,
    targetTime
}) => {
    const t = useI18n();

    if (loading) {
        return (
            <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)] mx-auto mb-3" />
                <p className="text-sm text-[var(--text-secondary)] font-data animate-pulse">
                    {t.aiPrediction.warpMessages[0]}
                </p>
            </div>
        );
    }

    if (!prediction) return null;

    const usp = details?.usp;
    // 종합 점수(0-100%)를 항상 메인으로 표시 — 관측 품질 원형과 동일 기준
    const displayValue = prediction.probability;
    const displayMax = '%';

    const getValueColor = (val: number): string => {
        if (val > 70) return 'var(--seeing-exceptional)';
        if (val > 40) return 'var(--seeing-fair)';
        return 'var(--seeing-very-poor)';
    };

    const valueColor = getValueColor(displayValue);

    return (
        <div className="glass-card-inner p-5 animate-scale-in text-center">
            {/* Scan target time */}
            {targetTime && (
                <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Clock className="w-3.5 h-3.5 text-[var(--warp-purple)]" />
                    <span className="text-xs font-data font-bold text-[var(--warp-purple)] uppercase tracking-wider">
                        {t.aiPrediction.scanTarget}: {targetTime}
                    </span>
                </div>
            )}

            <div className="text-xs font-data uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-3 font-medium">
                {t.aiPrediction.observationScore}{usp ? ` · ${t.aiPrediction.atmStability} ${usp.score.toFixed(1)}/10` : ''}
            </div>

            <div className="flex items-center justify-center gap-3 mb-3">
                {hasPrev && (
                    <button
                        onClick={onPrev}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)] transition-colors active:scale-90"
                        aria-label="Previous slot"
                    >
                        <ChevronLeft className="w-5 h-5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" />
                    </button>
                )}
                <div className="flex items-baseline">
                    <span className="text-5xl font-data font-bold" style={{ color: valueColor }}>
                        {displayValue}
                    </span>
                    <span className="text-lg font-data font-bold text-[var(--text-tertiary)]">{displayMax}</span>
                </div>
                {hasNext && (
                    <button
                        onClick={onNext}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)] transition-colors active:scale-90"
                        aria-label="Next slot"
                    >
                        <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" />
                    </button>
                )}
            </div>

            <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed mb-5 max-w-sm mx-auto">
                {prediction.comment}
            </p>

            {details && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm text-left bg-[var(--bg-surface)] p-4 rounded-xl mx-auto max-w-sm border border-[var(--glass-border)]">
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">{t.aiPrediction.seeingUsp}</span>
                        <span className="font-data font-bold text-[var(--cyan)]">{usp ? usp.seeing : details.seeing}"</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">{t.aiPrediction.friedR0}</span>
                        <span className="font-data font-bold text-[var(--text-primary)]">{usp ? usp.details.r0 : '-'} cm</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">{t.aiPrediction.stability}</span>
                        <span className="font-data font-bold text-[var(--text-primary)]">{usp ? usp.details.stability : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">{t.aiPrediction.jetStream}</span>
                        <span className="font-data font-bold text-[var(--text-primary)]">{usp ? usp.details.jetStream : 'N/A'}</span>
                    </div>
                    <div className="col-span-2 h-px bg-[var(--glass-border)] my-1" />
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">{t.aiPrediction.cloud}</span>
                        <span className="font-data font-bold text-[var(--text-primary)]">{details.cloudCover}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">{t.aiPrediction.wind}</span>
                        <span className="font-data font-bold text-[var(--text-primary)]">{details.windSpeed}m/s</span>
                    </div>
                </div>
            )}

            <button
                onClick={onClose}
                className="mt-5 text-sm text-[var(--warp-purple)] hover:text-[var(--text-primary)] transition-colors font-medium"
            >
                {t.aiPrediction.warpAnother}
            </button>
        </div>
    );
};

export default PredictionCard;
