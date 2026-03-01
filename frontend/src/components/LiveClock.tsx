import React, { useState, useEffect } from 'react';

interface LiveClockProps {
    timezone?: string;
    compact?: boolean;
}

const LiveClock: React.FC<LiveClockProps> = ({ timezone, compact }) => {
    // Fallback to browser timezone if API returns UTC or undefined
    const resolvedTz = (timezone && timezone !== 'UTC' && timezone !== 'GMT')
        ? timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [now, setNow] = useState<Date>(new Date());

    useEffect(() => {
        const interval = compact ? 10000 : 1000; // compact: 10s update, full: 1s
        const timer = setInterval(() => setNow(new Date()), interval);
        return () => clearInterval(timer);
    }, [compact]);

    const formatTime = (date: Date) => {
        if (compact) {
            return date.toLocaleTimeString('en-US', {
                timeZone: resolvedTz,
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
        return date.toLocaleTimeString('en-US', {
            timeZone: resolvedTz,
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    if (compact) {
        return (
            <span
                className="text-sm font-data font-medium text-[var(--text-secondary)] tracking-wide"
                style={{ fontVariantNumeric: 'tabular-nums' }}
            >
                {formatTime(now)}
            </span>
        );
    }

    return (
        <div className="flex items-center gap-2 bg-[var(--bg-surface)] backdrop-blur-md px-4 py-1.5 rounded-full border border-[var(--glass-border)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-sm font-data font-medium text-[var(--text-primary)] tracking-wide">
                {formatTime(now)}
            </span>
        </div>
    );
};

export default React.memo(LiveClock);
