import React, { useState, useEffect } from 'react';

interface LiveClockProps {
    timezone?: string;
}

const LiveClock: React.FC<LiveClockProps> = ({ timezone }) => {
    // Fallback to browser timezone if API returns UTC or undefined
    const resolvedTz = (timezone && timezone !== 'UTC' && timezone !== 'GMT')
        ? timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [now, setNow] = useState<Date>(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            timeZone: resolvedTz,
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

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
