import React from 'react';

interface TimeSliderProps {
    selectedIndex: number;
    maxIndex: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    startLabel?: string;
    targetTimeLabel: string;
    midTimeLabel?: string;
    endTimeLabel?: string;
}

const TimeSlider: React.FC<TimeSliderProps> = ({
    selectedIndex,
    maxIndex,
    onChange,
    startLabel = "Now",
    targetTimeLabel,
    midTimeLabel = '+12h',
    endTimeLabel = '+24h'
}) => {
    return (
        <div className="mb-6 px-1">
            <div className="flex justify-between text-xs font-data text-[var(--text-tertiary)] mb-2 uppercase tracking-wider font-medium">
                <span>{startLabel}</span>
                <span>{midTimeLabel}</span>
                <span>{endTimeLabel}</span>
            </div>
            <input
                type="range"
                min="0"
                max={maxIndex}
                value={selectedIndex}
                onChange={onChange}
                className="w-full"
            />
            <div className="mt-2 text-center">
                <span className="text-xs text-[var(--text-secondary)]">Target: </span>
                <span className="text-sm font-data font-semibold text-[var(--accent)]">{targetTimeLabel}</span>
            </div>
        </div>
    );
};

export default TimeSlider;
