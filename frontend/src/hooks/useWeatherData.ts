import { useState, useEffect, useRef } from 'react';
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
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        if (lat === null || lon === null) {
            // Coords not yet available — keep loading true but don't fetch
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
                if (isMountedRef.current) {
                    setData(result);
                    setLoading(false);
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    // Request aborted — don't update state
                    return;
                }
                if (isMountedRef.current) {
                    setError(err instanceof Error ? err.message : 'An error occurred');
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            isMountedRef.current = false;
            controller.abort();
        };
    }, [lat, lon]);

    return { data, loading, error };
};

export default useWeatherData;
