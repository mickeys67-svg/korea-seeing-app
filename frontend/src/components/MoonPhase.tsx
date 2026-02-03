import React from 'react';
import { Moon } from 'lucide-react';

interface MoonProps {
    data: {
        phase: number; // 0.0 - 1.0
        phaseName: string;
        fraction: number;
        rise: string;
        set: string;
    };
}

const MoonPhase: React.FC<MoonProps> = ({ data }) => {
    // Simple visual representation logic (could be replaced by actual moon icons/images)
    const percentage = Math.round(data.fraction * 100);

    return (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-md text-white">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Moon className="w-6 h-6 text-yellow-200" />
                Moon Phase
            </h2>

            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-2xl font-bold text-yellow-100">{data.phaseName}</span>
                    <span className="text-sm text-gray-400">Illumination: {percentage}%</span>
                </div>
                {/* Placeholder for Moon visual - could be an SVG that changes path based on phase */}
                <div className="w-16 h-16 rounded-full bg-gray-600 border-2 border-gray-500 flex items-center justify-center overflow-hidden relative">
                    <div
                        className="absolute bg-yellow-200 rounded-full h-full w-full opacity-80"
                        style={{ clipPath: `inset(0 ${100 - percentage}% 0 0)` }}
                    />
                </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between border-b border-gray-600 pb-1">
                    <span className="text-gray-400">Rise</span>
                    <span>{new Date(data.rise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between border-b border-gray-600 pb-1">
                    <span className="text-gray-400">Set</span>
                    <span>{new Date(data.set).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        </div>
    );
};

export default MoonPhase;
