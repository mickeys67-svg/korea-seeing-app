import React from 'react';
import SeeingDetails from './SeeingDetails';
import MoonPhase from './MoonPhase';
import NotificationSetup from './NotificationSetup';
import AiPrediction from './AiPrediction';
import ForecastList from './ForecastList';
import { Loader2, MapPin } from 'lucide-react';
import useGeolocation from '../hooks/useGeolocation';
import useWeatherData from '../hooks/useWeatherData';

const Dashboard: React.FC = () => {
    // 1. Get Location
    const location = useGeolocation();
    const defaultLat = 37.5665;
    const defaultLon = 126.9780;

    // Determine effective lat/lon (only if location loaded)
    const lat = location.loaded
        ? (location.val ? location.val.lat : defaultLat)
        : null;
    const lon = location.loaded
        ? (location.val ? location.val.lon : defaultLon)
        : null;

    // 2. Fetch Data using Custom Hook
    const { data, loading, error } = useWeatherData(lat, lon);

    if (loading || !location.loaded) {
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
    const currentForecast = data.forecast && data.forecast.length > 0 ? data.forecast[0] : null;

    return (
        <div className="flex flex-col items-center p-6 space-y-6 w-full max-w-4xl mx-auto">
            <header className="w-full flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <img src="/logo.jpg" alt="Logo" className="w-12 h-12 rounded-full border-2 border-blue-400 object-cover animate-logo-glow" />
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                            Clear skies !
                        </h1>
                        <div className="flex items-center text-gray-400 text-sm mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {location.name || (location.val ? "GPS Location" : "Seoul, South Korea (Default)")}
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {currentForecast && <SeeingDetails data={currentForecast} />}
                {data.astronomy && <MoonPhase data={data.astronomy} />}
            </div>

            {/* AI Prediction Module (Time Travel Enabled) */}
            {data.forecast && data.forecast.length > 0 && (
                <AiPrediction
                    forecastList={data.forecast}
                    timezone={data.location.timezone}
                    aiSummary={data.aiSummary}
                />
            )}

            {/* Use the new ForecastList component - Showing approx 6 days (48 points * 3h = 144h = 6 days) */}
            {data.forecast && <ForecastList forecast={data.forecast.slice(0, 48)} />}

            <NotificationSetup />

            {/* SEO & Community Keywords Section (Hidden but crawlable) */}
            <div className="sr-only" aria-hidden="true">
                <p>
                    Precision Seeing Forecast for Astrophotographers • Steady Skies & Stable Air Analysis
                    • Community Trusted Stargazing Predictor • Built for Cloudy Nights & AstroBin Users
                </p>
                <div className="font-mono italic">
                    <span>FWHM Estimation</span>
                    <span>Antoniadi Scale Ref</span>
                    <span>Pickering Scale Model</span>
                    <span>Atmospheric Scintillation Analysis</span>
                    <span>Planetary Imaging Stability</span>
                </div>
            </div>

            {/* Version Footer for Debugging */}
            <div className="mt-8 text-center text-xs text-gray-600 font-medium pb-12">
                <p>Clearskies ! Forme Observatory Ganghwado Island v2.5 (Live)</p>
            </div>
        </div>
    );
};

export default Dashboard;
