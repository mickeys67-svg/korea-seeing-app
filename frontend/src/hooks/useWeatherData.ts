import { useState, useEffect, useRef } from 'react';
import type { WeatherData } from '../types/weather';

interface UseWeatherDataReturn {
    data: WeatherData | null;
    loading: boolean;
    error: string | null;
    stale: boolean;
}

const MAX_RETRIES = 2;
const RETRY_DELAY = 15000; // 15초
const CACHE_KEY = 'clearsky_weather_cache';
const CACHE_MAX_AGE = 6 * 60 * 60 * 1000; // 6시간

function saveToCache(lat: number, lon: number, data: WeatherData) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            lat, lon, data, ts: Date.now()
        }));
    } catch { /* localStorage full or unavailable */ }
}

function loadFromCache(lat: number, lon: number): WeatherData | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (!cached || cached.lat == null || cached.lon == null || !cached.data || !cached.ts) return null;
        if (Math.abs(cached.lat - lat) > 0.5 || Math.abs(cached.lon - lon) > 0.5) return null;
        if (Date.now() - cached.ts > CACHE_MAX_AGE) return null;
        return cached.data as WeatherData;
    } catch { return null; }
}

const useWeatherData = (lat: number | null, lon: number | null): UseWeatherDataReturn => {
    const [data, setData] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [stale, setStale] = useState<boolean>(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        if (lat === null || lon === null) {
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
                    setStale(false);
                }
                const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`, {
                    signal,
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch weather data');
                }
                const result: WeatherData = await response.json();
                if (isMountedRef.current) {
                    setData(result);
                    setLoading(false);
                    setError(null);
                    setStale(false);
                    saveToCache(lat, lon, result);
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
                        // 최종 실패 → 브라우저 캐시에서 복구 시도
                        const cached = loadFromCache(lat, lon);
                        if (cached) {
                            setData(cached);
                            setStale(true);
                            setError(null);
                            setLoading(false);
                        } else {
                            setError('데이터를 불러올 수 없습니다. 잠시 후 새로고침 해주세요.');
                            setLoading(false);
                        }
                    }
                }
            }
        };

        // Stale-while-revalidate: 캐시 데이터 즉시 표시 → 백그라운드 갱신
        const cached = loadFromCache(lat, lon);
        if (cached) {
            setData(cached);
            setLoading(false);
            setStale(true);
        }

        fetchData();

        return () => {
            isMountedRef.current = false;
            controller.abort();
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [lat, lon]);

    return { data, loading, error, stale };
};

export default useWeatherData;
