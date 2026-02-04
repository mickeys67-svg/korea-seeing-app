import { useState, useEffect } from 'react';
import type { WeatherData } from '../types/weather';

interface UseWeatherDataReturn {
    data: WeatherData | null;
    loading: boolean;
    error: string | null;
}

const useWeatherData = (lat: number | null, lon: number | null): UseWeatherDataReturn => {
    const [data, setData] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // If lat/lon are not yet available (e.g., initial load), don't fetch yet
        // But if they are null because geolocation failed, we might want to use default inside here?
        // Actually, the component handles default values. So if passed, we fetch.
        if (lat === null || lon === null) {
            // Keep loading true or set to false? 
            // If we expect them to be populated, we wait.
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}&_t=${Date.now()}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch weather data');
                }
                const result: WeatherData = await response.json();
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [lat, lon]);

    return { data, loading, error };
};

export default useWeatherData;
