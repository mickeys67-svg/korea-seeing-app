/**
 * Shared color utility functions for weather/seeing score display.
 * Extracted from ForecastList, SeeingDetails, TargetPredictionGrid to eliminate duplication.
 */

/** Map observation score (0-100) to CSS color variable */
export const getScoreColor = (score: number): string => {
    if (score >= 85) return 'var(--seeing-exceptional)';
    if (score >= 70) return 'var(--seeing-excellent)';
    if (score >= 55) return 'var(--seeing-good)';
    if (score >= 40) return 'var(--seeing-fair)';
    if (score >= 25) return 'var(--seeing-poor)';
    return 'var(--seeing-very-poor)';
};

/** Map seeing component score (0-8) to CSS color variable */
export const getSeeingColor = (s: number): string => {
    if (s <= 2) return 'var(--seeing-exceptional)';
    if (s <= 4) return 'var(--seeing-good)';
    if (s <= 6) return 'var(--seeing-fair)';
    return 'var(--seeing-very-poor)';
};
