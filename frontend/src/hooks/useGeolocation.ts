import { useState, useEffect } from 'react';

interface LocationState {
    loaded: boolean;
    val: { lat: number; lon: number } | null;
    name: string | null;
    error: string | null;
}

// Default: Seoul
const DEFAULT_LAT = 37.5665;
const DEFAULT_LON = 126.9780;

// 이 기기에 저장된 마지막 위치 복원 — 위젯(location-selector.js)이 cls_current에 저장한다.
// 새로고침해도 서울로 리셋되지 않고 사용자가 고른 위치를 유지한다.
function readSavedLocation(): { lat: number; lon: number; name: string | null } | null {
    try {
        const s = JSON.parse(localStorage.getItem('cls_current') || 'null');
        if (s && typeof s.lat === 'number' && typeof s.lng === 'number') {
            return { lat: s.lat, lon: s.lng, name: s.name || null };
        }
    } catch { /* storage 차단 환경 */ }
    return null;
}

const useGeolocation = () => {
    const saved = readSavedLocation();
    const [location, setLocation] = useState<LocationState>({
        loaded: true,
        val: saved ? { lat: saved.lat, lon: saved.lon } : { lat: DEFAULT_LAT, lon: DEFAULT_LON },
        name: saved ? saved.name : null,
        error: null,
    });

    useEffect(() => {
        const handleLocationChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            const loc = customEvent.detail;
            if (loc && (loc.lat || loc.lat === 0) && (loc.lng || loc.lng === 0)) {
                setLocation({
                    loaded: true,
                    val: { lat: loc.lat, lon: loc.lng },
                    name: loc.name || "Selected Location",
                    error: null
                });
            }
        };

        document.addEventListener('cls:location:changed', handleLocationChange);

        return () => {
            document.removeEventListener('cls:location:changed', handleLocationChange);
        };
    }, []);

    return { ...location, refresh: () => {} };
};

export default useGeolocation;
