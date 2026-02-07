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
        if (lat === null || lon === null) {
            return;
        }

        const controller = new AbortController();
        const signal = controller.signal;

        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}&_t=${Date.now()}`, { signal });
                if (!response.ok) {
                    throw new Error('Failed to fetch weather data');
                }
                const result: WeatherData = await response.json();
                setData(result);
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    // Do nothing for aborted requests
                    return;
                }
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            controller.abort();
        };
    }, [lat, lon]);

    return { data, loading, error };
};

export default useWeatherData;
