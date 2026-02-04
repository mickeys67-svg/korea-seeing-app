import React from 'react';
import { Cloud, Eye, Wind, Droplets, Plane, ThermometerSun } from 'lucide-react';
import InfoModal from './InfoModal';
import type { ForecastItem } from '../types/weather';

interface SeeingProps {
    data: ForecastItem;
}

const SeeingDetails: React.FC<SeeingProps> = ({ data }) => {
    const [selectedMetric, setSelectedMetric] = React.useState<{ title: string; desc: string; ranges?: any[] } | null>(null);

    // Component Score Color: 0 (Best/Green) -> 8 (Worst/Red)
    const getComponentColor = (value: number) => {
        if (value <= 2) return 'text-green-400'; // Best
        if (value <= 4) return 'text-green-200'; // Good
        if (value <= 6) return 'text-yellow-400'; // Average
        return 'text-red-400'; // Poor
    };

    // Final Score Color: 100 (Best/Green) -> 0 (Worst/Red)
    const getFinalScoreColor = (score: number) => {
        if (score >= 85) return 'text-green-400'; // S
        if (score >= 70) return 'text-blue-400';  // A
        if (score >= 55) return 'text-yellow-400'; // B
        if (score >= 40) return 'text-orange-400'; // C
        return 'text-red-500'; // D
    };

    const metrics = {
        seeing: {
            title: "Astronomical Seeing",
            desc: "A measure of the turbulence of the atmosphere. Lower score is better (0-8 scale).",
            ranges: [
                { label: "0-2 (Excellent)", value: "Stable" },
                { label: "3-5 (Average)", value: "Moderate" },
                { label: "6-8 (Poor)", value: "Turbulent" }
            ]
        },
        transparency: {
            title: "Sky Transparency",
            desc: "A measure of the sky's clarity. Lower score is better (0-8 scale).",
            ranges: [
                { label: "0-2 (Clear)", value: "High Transparency" },
                { label: "6-8 (Hazy)", value: "Low Transparency" }
            ]
        },
        cloud: {
            title: "Cloud Cover",
            desc: "Cloud coverage score. Lower is better.",
            ranges: [
                { label: "0 (Clear)", value: "0%" },
                { label: "8 (Overcast)", value: "100%" }
            ]
        },
        wind: {
            title: "Surface Wind",
            desc: "Wind stability score. Lower is better.",
            ranges: [
                { label: "0 (Calm)", value: "< 2m/s" },
                { label: "8 (Strong)", value: "> 12m/s" }
            ]
        },
        jetStream: {
            title: "Jet Stream (High Altitude Wind)",
            desc: "High altitude winds (250hPa) affecting seeing. Lower score is better.",
            ranges: [
                { label: "0 (Calm)", value: "< 50kt" },
                { label: "8 (Strong)", value: "> 150kt" }
            ]
        },
        convection: {
            title: "Atmospheric Convection",
            desc: "Vertical instability (CAPE). Lower score is better.",
            ranges: [
                { label: "0 (Stable)", value: "Low CAPE" },
                { label: "8 (Unstable)", value: "High CAPE" }
            ]
        }
    };

    const scores = data.scores;

    return (
        <>
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-md">
                {/* Header: Final Score */}
                <div className="mb-6 text-center border-b border-gray-700 pb-4">
                    <h2 className="text-xl font-bold flex items-center justify-center gap-2 text-white mb-2">
                        <Eye className="w-6 h-6 text-blue-400" />
                        Observation Quality
                    </h2>
                    <div className="flex flex-col items-center">
                        <span className={`text-5xl font-extrabold ${getFinalScoreColor(data.score)}`}>
                            {data.score}
                        </span>
                        <span className={`text-xl font-bold mt-1 ${getFinalScoreColor(data.score)}`}>
                            Grade {data.grade}
                        </span>
                        <p className="text-gray-400 text-sm mt-2 px-4 italic">
                            {data.recommendation}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Seeing */}
                    <div
                        className="bg-gray-700 p-3 rounded-xl flex flex-col items-center cursor-pointer hover:bg-gray-600 transition-colors active:scale-95"
                        onClick={() => setSelectedMetric(metrics.seeing)}
                    >
                        <span className="text-gray-400 text-sm">Seeing</span>
                        <span className={`text-2xl font-bold ${getComponentColor(scores.seeing)}`}>
                            {scores.seeing}<span className="text-sm text-gray-500">/8</span>
                        </span>
                    </div>

                    {/* Transparency */}
                    <div
                        className="bg-gray-700 p-3 rounded-xl flex flex-col items-center cursor-pointer hover:bg-gray-600 transition-colors active:scale-95"
                        onClick={() => setSelectedMetric(metrics.transparency)}
                    >
                        <span className="text-gray-400 text-sm">Transparency</span>
                        <span className={`text-2xl font-bold ${getComponentColor(scores.transparency)}`}>
                            {scores.transparency}<span className="text-sm text-gray-500">/8</span>
                        </span>
                    </div>

                    {/* Cloud Cover */}
                    <div
                        className="bg-gray-700 p-3 rounded-xl flex flex-col items-center cursor-pointer hover:bg-gray-600 transition-colors active:scale-95"
                        onClick={() => setSelectedMetric(metrics.cloud)}
                    >
                        <Cloud className="w-5 h-5 mb-1 text-gray-400" />
                        <span className="text-gray-400 text-xs">Cloud</span>
                        <span className={`text-xl font-bold ${getComponentColor(scores.cloudCover)}`}>
                            {scores.cloudCover}/8
                        </span>
                    </div>

                    {/* Wind */}
                    <div
                        className="bg-gray-700 p-3 rounded-xl flex flex-col items-center cursor-pointer hover:bg-gray-600 transition-colors active:scale-95"
                        onClick={() => setSelectedMetric(metrics.wind)}
                    >
                        <Wind className="w-5 h-5 mb-1 text-gray-400" />
                        <span className="text-gray-400 text-xs">Wind</span>
                        <span className={`text-xl font-bold ${getComponentColor(scores.wind)}`}>
                            {scores.wind}/8
                        </span>
                    </div>

                    {/* Jet Stream */}
                    <div
                        className="bg-gray-700 p-3 rounded-xl flex flex-col items-center cursor-pointer hover:bg-gray-600 transition-colors active:scale-95"
                        onClick={() => setSelectedMetric(metrics.jetStream)}
                    >
                        <Plane className="w-5 h-5 mb-1 text-gray-400 rotate-45" />
                        <span className="text-gray-400 text-xs">Jet Stream</span>
                        <span className={`text-xl font-bold ${getComponentColor(scores.jetStream)}`}>
                            {scores.jetStream}/8
                        </span>
                    </div>

                    {/* Convection */}
                    <div
                        className="bg-gray-700 p-3 rounded-xl flex flex-col items-center cursor-pointer hover:bg-gray-600 transition-colors active:scale-95"
                        onClick={() => setSelectedMetric(metrics.convection)}
                    >
                        <ThermometerSun className="w-5 h-5 mb-1 text-gray-400" />
                        <span className="text-gray-400 text-xs">Convection</span>
                        <span className={`text-xl font-bold ${getComponentColor(scores.convection)}`}>
                            {scores.convection}/8
                        </span>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-gray-700/50 rounded-lg flex justify-between items-center px-6">
                    <div className="flex flex-col items-center">
                        <Droplets className="w-4 h-4 text-blue-300 mb-1" />
                        <span className="text-xs text-gray-400">Humidity</span>
                        <span className="font-mono text-blue-200">{data.rh2m}%</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400">Temp</span>
                        <span className="font-mono text-yellow-200">{data.temp2m}°C</span>
                    </div>
                </div>

            </div>

            <InfoModal
                isOpen={!!selectedMetric}
                onClose={() => setSelectedMetric(null)}
                title={selectedMetric?.title || ''}
                description={selectedMetric?.desc || ''}
                ranges={selectedMetric?.ranges}
            />
        </>
    );
};

export default SeeingDetails;
