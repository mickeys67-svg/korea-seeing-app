import React from 'react';
import { Cloud, Eye, Wind, Droplets } from 'lucide-react';

interface SeeingProps {
    data: {
        cloudCover: number;
        seeing: number;
        transparency: number;
        rh2m: number;
        wind10m: {
            direction: string;
            speed: number;
        };
        temp2m: number;
    };
}

const SeeingDetails: React.FC<SeeingProps> = ({ data }) => {
    // Helper to get Color based on quality (Lower is better for Seeing/Transparency in 7Timer but we might want to map it)
    // 7Timer: 1 is best, 8 is worst.
    const getQualityColor = (value: number) => {
        if (value <= 2) return 'text-green-400';
        if (value <= 5) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                <Eye className="w-6 h-6 text-blue-400" />
                Astronomical Seeing
            </h2>

            <div className="grid grid-cols-2 gap-4">
                {/* Seeing */}
                <div className="bg-gray-700 p-4 rounded-xl flex flex-col items-center">
                    <span className="text-gray-400 text-sm">Seeing</span>
                    <span className={`text-2xl font-bold ${getQualityColor(data.seeing)}`}>
                        {data.seeing}/8
                    </span>
                    <span className="text-xs text-gray-500">Stability</span>
                </div>

                {/* Transparency */}
                <div className="bg-gray-700 p-4 rounded-xl flex flex-col items-center">
                    <span className="text-gray-400 text-sm">Transparency</span>
                    <span className={`text-2xl font-bold ${getQualityColor(data.transparency)}`}>
                        {data.transparency}/8
                    </span>
                    <span className="text-xs text-gray-500">Clarity</span>
                </div>

                {/* Cloud Cover */}
                <div className="bg-gray-700 p-4 rounded-xl flex flex-col items-center">
                    <Cloud className="w-5 h-5 mb-1 text-gray-400" />
                    <span className="text-gray-400 text-sm">Cloud Cover</span>
                    <span className="text-xl font-semibold text-white">
                        {data.cloudCover}/9
                    </span>
                </div>

                {/* Wind */}
                <div className="bg-gray-700 p-4 rounded-xl flex flex-col items-center">
                    <Wind className="w-5 h-5 mb-1 text-gray-400" />
                    <span className="text-gray-400 text-sm">Wind</span>
                    <span className="text-xl font-semibold text-white">
                        {data.wind10m.speed}
                    </span>
                    <span className="text-xs text-gray-500">m/s</span>
                </div>
            </div>

            <div className="mt-4 p-3 bg-gray-700/50 rounded-lg flex justify-between items-center px-6">
                <div className="flex flex-col items-center">
                    <Droplets className="w-4 h-4 text-blue-300 mb-1" />
                    <span className="text-xs text-gray-400">Humidity</span>
                    <span className="font-mono text-blue-200">{data.rh2m}</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-400">Temp</span>
                    <span className="font-mono text-yellow-200">{data.temp2m}°C</span>
                </div>
            </div>

        </div>
    );
};

export default SeeingDetails;
