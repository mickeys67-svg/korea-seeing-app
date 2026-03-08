import React, { useState, useCallback } from 'react';
import { Star, Send, Check } from 'lucide-react';
import useI18n from '../hooks/useI18n';

interface FeedbackButtonProps {
    lat: number;
    lon: number;
    timestamp: string;
}

const FeedbackButton: React.FC<FeedbackButtonProps> = ({ lat, lon, timestamp }) => {
    const t = useI18n();
    const [rating, setRating] = useState<number>(0);
    const [hoveredStar, setHoveredStar] = useState<number>(0);
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showComment, setShowComment] = useState(false);

    const ratingLabels = t.feedback.ratingLabels;

    const handleSubmit = useCallback(async () => {
        if (rating === 0 || submitting) return;

        setSubmitting(true);
        try {
            const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:8080';
            await fetch(`${baseUrl}/api/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat,
                    lon,
                    timestamp,
                    rating,
                    comment: comment.trim() || undefined,
                }),
            });
            setSubmitted(true);
        } catch {
            // Show error — let user retry
            setSubmitting(false);
            return;
        } finally {
            setSubmitting(false);
        }
    }, [rating, comment, lat, lon, timestamp, submitting]);

    if (submitted) {
        return (
            <div className="mt-6 flex items-center justify-center gap-2 py-3 text-sm text-emerald-400/90 animate-fade-in-up">
                <Check className="w-4 h-4" />
                <span>{t.feedback.thankYou}</span>
            </div>
        );
    }

    return (
        <div className="mt-6 pt-5 border-t border-[var(--glass-border)]">
            {/* Question */}
            <p className="text-xs text-center text-[var(--text-secondary)] mb-3 tracking-wide">
                {t.feedback.question}
            </p>

            {/* Star Rating */}
            <div className="flex justify-center gap-1.5 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        onClick={() => {
                            setRating(star);
                            setShowComment(true);
                        }}
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(0)}
                        className="p-1 transition-transform active:scale-90 hover:scale-110"
                        aria-label={`${star} star`}
                    >
                        <Star
                            className="w-7 h-7 transition-colors"
                            fill={(hoveredStar || rating) >= star ? '#fbbf24' : 'transparent'}
                            stroke={(hoveredStar || rating) >= star ? '#fbbf24' : 'rgba(255,255,255,0.25)'}
                            strokeWidth={1.5}
                        />
                    </button>
                ))}
            </div>

            {/* Rating Label */}
            {(hoveredStar > 0 || rating > 0) && (
                <p className="text-xs text-center text-amber-400/80 mb-3 font-medium animate-fade-in-up">
                    {ratingLabels[(hoveredStar || rating) - 1]}
                </p>
            )}

            {/* Comment + Submit (shown after star selection) */}
            {showComment && (
                <div className="flex flex-col gap-2.5 animate-fade-in-up">
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t.feedback.commentPlaceholder}
                        maxLength={500}
                        rows={2}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-white/5 border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none focus:outline-none focus:border-cyan-500/40 transition-colors"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={rating === 0 || submitting}
                        className="self-center flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 active:scale-95 transition-all disabled:opacity-40"
                    >
                        <Send className="w-3 h-3" />
                        {t.feedback.submit}
                    </button>
                </div>
            )}
        </div>
    );
};

export default FeedbackButton;
