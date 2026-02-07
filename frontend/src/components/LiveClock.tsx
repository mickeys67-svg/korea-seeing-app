import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface LiveClockProps {
    timezone?: string;
}

const LiveClock: React.FC<LiveClockProps> = ({ timezone = 'UTC' }) => {
    const [now, setNow] = useState<Date>(new Date());

    useEffect(() => {
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

    return (
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-purple-500/30 shadow-lg">
            <Clock className="w-4 h-4 text-purple-300" />
            <span className="text-lg font-bold text-white tracking-wide font-mono">
                {formatTime(now)}
            </span>
        </div>
    );
};

export default React.memo(LiveClock);
