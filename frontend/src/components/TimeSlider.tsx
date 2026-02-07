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
        <div className="mb-8 px-2">
            <div className="flex justify-between text-xs text-purple-300 mb-2 font-medium">
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
                className="w-full h-2 bg-purple-900 rounded-lg appearance-none cursor-pointer accent-purple-400 hover:accent-purple-300 transition-all"
            />
            <div className="mt-2 text-center text-white font-bold text-sm">
                Target: <span className="text-purple-300">{targetTimeLabel}</span>
            </div>
        </div>
    );
};

export default TimeSlider;
