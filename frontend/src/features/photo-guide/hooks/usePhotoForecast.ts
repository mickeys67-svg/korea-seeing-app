/**
 * v5.0 Photo Guide — /api/photo-forecast fetch hook (feature-local)
 *
 * useWeatherData.ts 와 동일한 패턴을 따르되, photo-forecast 전용.
 * - AbortController + mount guard
 * - 2회 재시도 + 최종 실패 시 localStorage stale 복구
 * - 별도 캐시 키: `clearsky_photo_cache`
 * - `no-cache` 헤더로 브라우저 HTTP 캐시는 우회, localStorage fallback 만 사용
 *
 * 기존 /api/weather 훅과 완전히 독립. 모달 open 시에만 마운트되므로
 * Dashboard 진입 시 네트워크 요청 0.
 */
import { useEffect, useRef, useState } from 'react';
import type { PhotoForecast } from '../types';

interface UsePhotoForecastReturn {
    data: PhotoForecast | null;
    loading: boolean;
    error: string | null;
    stale: boolean;
}

const MAX_RETRIES = 2;
const RETRY_DELAY = 15000; // 15s
const CACHE_KEY = 'clearsky_photo_cache';
const CACHE_MAX_AGE = 6 * 60 * 60 * 1000; // 6h

interface CachedEntry {
    lat: number;
    lon: number;
    lang: string;
    data: PhotoForecast;
    ts: number;
}

function saveToCache(lat: number, lon: number, lang: string, data: PhotoForecast) {
    try {
        const entry: CachedEntry = { lat, lon, lang, data, ts: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch { /* quota / disabled */ }
}

function loadFromCache(lat: number, lon: number, lang: string): PhotoForecast | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw) as CachedEntry | null;
        if (!cached || cached.lat == null || cached.lon == null || !cached.data || !cached.ts) return null;
        if (cached.lang !== lang) return null;
        if (Math.abs(cached.lat - lat) > 0.5 || Math.abs(cached.lon - lon) > 0.5) return null;
        if (Date.now() - cached.ts > CACHE_MAX_AGE) return null;
        return cached.data;
    } catch { return null; }
}

export function usePhotoForecast(
    lat: number | null,
    lon: number | null,
    lang: string = 'ko',
): UsePhotoForecastReturn {
    const [data, setData] = useState<PhotoForecast | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [stale, setStale] = useState<boolean>(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        if (lat === null || lon === null) {
            setLoading(false);
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
                const url = `/api/photo-forecast?lat=${lat}&lon=${lon}&lang=${encodeURIComponent(lang)}`;
                const response = await fetch(url, {
                    signal,
                    headers: { 'Cache-Control': 'no-cache' },
                });
                if (!response.ok) {
                    throw new Error(`photo-forecast HTTP ${response.status}`);
                }
                const result = (await response.json()) as PhotoForecast;
                if (isMountedRef.current) {
                    setData(result);
                    setLoading(false);
                    setError(null);
                    setStale(false);
                    saveToCache(lat, lon, lang, result);
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
                if (!isMountedRef.current) return;

                if (attempt < MAX_RETRIES) {
                    setError(`retry ${attempt + 1}/${MAX_RETRIES}`);
                    setLoading(true);
                    retryTimeout = setTimeout(() => fetchData(attempt + 1), RETRY_DELAY);
                } else {
                    const cached = loadFromCache(lat, lon, lang);
                    if (cached) {
                        setData(cached);
                        setStale(true);
                        setError(null);
                        setLoading(false);
                    } else {
                        setError('photo-forecast-failed');
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
    }, [lat, lon, lang]);

    return { data, loading, error, stale };
}

export default usePhotoForecast;
