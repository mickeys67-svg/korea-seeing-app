import React, { useEffect, useState } from 'react';
import SeeingDetails from './SeeingDetails';
import MoonPhase from './MoonPhase';
import NotificationSetup from './NotificationSetup';
import AiPrediction from './AiPrediction';
import { Loader2, MapPin } from 'lucide-react';

interface WeatherData {
    location: { lat: number; lon: number };
    moon: any;
    forecast: any[];
}

import useGeolocation from '../hooks/useGeolocation';

const Dashboard: React.FC = () => {
    const [data, setData] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Use Custom Hook for Geolocation
    const location = useGeolocation();

    // Default Fallback: Seoul
    const defaultLat = 37.5665;
    const defaultLon = 126.9780;

    useEffect(() => {
        // Only fetch when location is determined (or failed)
        if (!location.loaded) return;

        const lat = location.val ? location.val.lat : defaultLat;
        const lon = location.val ? location.val.lon : defaultLon;

        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch weather data');
                }
                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [location]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-red-400">
                Error: {error}
            </div>
        );
    }

    if (!data) return null;

    // Get current forecast (closest timepoint)
    // 7Timer returns timepoints in 3h intervals usually.
    const currentForecast = data.forecast && data.forecast.length > 0 ? data.forecast[0] : null;

    return (
        <div className="flex flex-col items-center p-6 space-y-6 w-full max-w-4xl mx-auto">
            <header className="w-full flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        Korea Sky Seeing
                    </h1>
                    <div className="flex items-center text-gray-400 text-sm mt-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        {location.val ? "Current GPS Location" : "Seoul, South Korea (Default)"}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {currentForecast && <SeeingDetails data={currentForecast} />}
                {data.moon && <MoonPhase data={data.moon} />}
            </div>

            {currentForecast && <AiPrediction weather={currentForecast} />}

            <div className="w-full bg-gray-800 p-6 rounded-2xl mt-6">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">3-Day Forecast (Simplifed)</h3>
                <div className="flex overflow-x-auto gap-4 pb-2">
                    {data.forecast.slice(0, 8).map((point: any, idx: number) => (
                        <div key={idx} className="flex-shrink-0 bg-gray-700 p-3 rounded-lg flex flex-col items-center min-w-[80px]">
                            <span className="text-xs text-gray-400">+{point.timepoint}h</span>
                            <span className="font-bold text-blue-300 my-1">{point.seeing}/8</span>
                            <span className="text-xs text-gray-500">See</span>
                        </div>
                    ))}
                </div>
            </div>

            <NotificationSetup />
        </div>
    );
};

export default Dashboard;
