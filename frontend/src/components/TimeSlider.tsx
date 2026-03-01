import React from 'react';

interface TimeSliderProps {
    selectedIndex: number;
    maxIndex: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    startLabel?: string;
    endLabel?: string;
}

const TimeSlider: React.FC<TimeSliderProps> = ({
    selectedIndex,
    maxIndex,
    onChange,
    startLabel = '',
    endLabel = '',
}) => {
    return (
        <div className="mb-5 px-1 relative z-10">
            {/* Slider */}
            <input
                type="range"
                min="0"
                max={maxIndex}
                value={selectedIndex}
                onChange={onChange}
                className="w-full"
            />

            {/* Start / End labels */}
            <div className="flex justify-between text-[11px] font-data text-[var(--text-tertiary)] mt-1.5 tracking-wider">
                <span>{startLabel}</span>
                <span>{endLabel}</span>
            </div>
        </div>
    );
};

export default TimeSlider;
