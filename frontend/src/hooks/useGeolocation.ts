import { useState, useEffect } from 'react';

interface LocationState {
    loaded: boolean;
    val: { lat: number; lon: number } | null;
    name: string | null;
    error: string | null;
}

const useGeolocation = () => {
    const [location, setLocation] = useState<LocationState>(() => {
        if (!("geolocation" in navigator)) {
            return {
                loaded: true,
                val: null,
                name: null,
                error: "Geolocation not supported",
            };
        }
        return {
            loaded: false,
            val: null,
            name: null,
            error: null,
        };
    });

    const onSuccess = (position: GeolocationPosition) => {
        setLocation(prev => ({
            ...prev,
            loaded: true,
            val: {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
            },
            name: "Current GPS Location",
            error: null,
        }));
    };

    const onError = (error: GeolocationPositionError) => {
        setLocation(prev => ({
            ...prev,
            loaded: true,
            val: null,
            name: null,
            error: error.message,
        }));
    };

    const refresh = () => {
        if (!("geolocation" in navigator)) return;
        setLocation(prev => ({ ...prev, loaded: false, error: null }));
        navigator.geolocation.getCurrentPosition(onSuccess, onError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    };

    useEffect(() => {
        if (!("geolocation" in navigator)) return;

        // Initial fetch
        navigator.geolocation.getCurrentPosition(onSuccess, onError);

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
        return () => document.removeEventListener('cls:location:changed', handleLocationChange);
    }, []);

    return { ...location, refresh };
};

export default useGeolocation;
