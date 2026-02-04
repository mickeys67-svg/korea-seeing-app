import React from 'react';
import type { ForecastItem } from '../types/weather';

interface ForecastListProps {
    forecast: ForecastItem[];
}

const ForecastList: React.FC<ForecastListProps> = ({ forecast }) => {
    // Function to format timepoint to Date string
    const formatTime = (hours: number) => {
        const date = new Date();
        date.setHours(date.getHours() + hours);

        // Format: "Mon 14:00" or just "14:00" if same day?
        // Let's do Day + Time for clarity over 6 days
        return {
            day: date.toLocaleDateString('en-US', { weekday: 'short' }),
            time: date.getHours() + ':00',
            fullDate: date.toLocaleDateString()
        };
    };

    return (
        <div className="w-full bg-gray-800 p-6 rounded-2xl mt-6">
            <h3 className="text-lg font-semibold text-gray-300 mb-4">6-Day Forecast</h3>
            <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {forecast.map((point: ForecastItem, idx: number) => {
                    const { day, time } = formatTime(point.timepoint);
                    // Seeing Score: 0 (Best) -> 8 (Worst)
                    const s = point.scores.seeing;
                    const color = s <= 2 ? 'text-green-400' : s <= 5 ? 'text-yellow-400' : 'text-red-400';

                    return (
                        <div key={idx} className="flex-shrink-0 bg-gray-700 p-3 rounded-lg flex flex-col items-center min-w-[90px] border border-gray-600/50">
                            <span className="text-xs text-blue-200 font-medium mb-1">{day}</span>
                            <span className="text-xs text-gray-400 mb-2">{time}</span>

                            <div className="flex flex-col items-center gap-1">
                                <span className={`font-bold text-lg ${color}`}>
                                    {s}
                                </span>
                                <span className="text-[10px] text-gray-500">Seeing</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ForecastList;
