import React from 'react';
import type { ForecastItem } from '../types/weather';

interface ForecastListProps {
    forecast: ForecastItem[];
}

const ForecastList: React.FC<ForecastListProps> = ({ forecast }) => {
    // Improved time formatting using backend ISO strings
    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return {
            day: date.toLocaleDateString('ko-KR', { weekday: 'short' }),
            time: date.getHours().toString().padStart(2, '0') + ':00',
            isNight: date.getHours() < 6 || date.getHours() > 18
        };
    };

    return (
        <div className="w-full bg-black/20 backdrop-blur-md p-6 rounded-3xl mt-8 border border-white/5 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-200 to-cyan-400 bg-clip-text text-transparent">
                    6-Day High-Res Forecast
                </h3>
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Ensemble Active
                </div>
            </div>

            <div className="flex overflow-x-auto gap-3 pb-4 no-scrollbar snap-x snap-mandatory">
                {forecast.map((point: ForecastItem, idx: number) => {
                    const { day, time, isNight } = formatTime(point.time);
                    const s = point.scores.seeing;
                    const confidence = point.raw?.confidence || 70;

                    // Colors based on score
                    const colorClass = s <= 2 ? 'text-green-400' : s <= 4 ? 'text-cyan-400' : s <= 6 ? 'text-yellow-400' : 'text-red-400';
                    const glowClass = s <= 2 ? 'shadow-[0_0_15px_rgba(74,222,128,0.2)]' : '';

                    return (
                        <div
                            key={idx}
                            className={`flex-shrink-0 snap-start group relative bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex flex-col items-center min-w-[100px] border border-white/5 transition-all duration-300 ${glowClass}`}
                        >
                            {/* Night Indicator Dot */}
                            {isNight && (
                                <div className="absolute top-2 right-2 w-1 h-1 bg-cyan-400 rounded-full blur-[1px]"></div>
                            )}

                            <span className="text-xs text-blue-200 font-bold mb-0.5">{day}</span>
                            <span className="text-[10px] text-gray-500 font-mono mb-4">{time}</span>

                            <div className="flex flex-col items-center gap-0.5 relative">
                                <span className={`font-black text-2xl tracking-tight transition-transform group-hover:scale-110 ${colorClass}`}>
                                    {s.toFixed(1)}
                                </span>
                                <span className="text-[8px] uppercase tracking-widest text-gray-500 font-bold">Seeing</span>
                            </div>

                            {/* Confidence Bar */}
                            <div className="mt-4 w-full h-[3px] bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-60"
                                    style={{ width: `${confidence}%` }}
                                ></div>
                            </div>
                            <span className="text-[7px] text-gray-600 mt-1 uppercase">Reliability {confidence}%</span>
                        </div>
                    );
                })}
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default ForecastList;
