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

const useGeolocation = () => {
    const [location, setLocation] = useState<LocationState>({
        loaded: true,
        val: { lat: DEFAULT_LAT, lon: DEFAULT_LON },
        name: null,
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
