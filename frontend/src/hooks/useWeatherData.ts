import { useState, useEffect, useRef } from 'react';
import type { WeatherData } from '../types/weather';

interface UseWeatherDataReturn {
    data: WeatherData | null;
    loading: boolean;
    error: string | null;
}

const MAX_RETRIES = 2;
const RETRY_DELAY = 15000; // 15초

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
        let retryTimeout: ReturnType<typeof setTimeout> | null = null;

        const fetchData = async (attempt = 0) => {
            try {
                if (attempt === 0) {
                    setLoading(true);
                    setError(null);
                }
                const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}&_t=${Date.now()}`, { signal });
                if (!response.ok) {
                    throw new Error('Failed to fetch weather data');
                }
                const result: WeatherData = await response.json();
                if (isMountedRef.current) {
                    setData(result);
                    setLoading(false);
                    setError(null);
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    return;
                }
                if (isMountedRef.current) {
                    if (attempt < MAX_RETRIES) {
                        setError(`데이터 수신 실패. 재시도 중... (${attempt + 1}/${MAX_RETRIES})`);
                        setLoading(true);
                        retryTimeout = setTimeout(() => fetchData(attempt + 1), RETRY_DELAY);
                    } else {
                        setError('데이터를 불러올 수 없습니다. 잠시 후 새로고침 해주세요.');
                        setLoading(false);
                    }
                }
            }
        };

        fetchData();

        return () => {
            isMountedRef.current = false;
            controller.abort();
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [lat, lon]);

    return { data, loading, error };
};

export default useWeatherData;
