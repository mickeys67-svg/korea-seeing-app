import { useState, useEffect } from 'react';

interface LocationState {
    loaded: boolean;
    val: { lat: number; lon: number } | null;
    error: string | null;
}

const useGeolocation = () => {
    const [location, setLocation] = useState<LocationState>(() => {
        // Lazy initialization to handle unsupported browser instantly without effect error
        if (!("geolocation" in navigator)) {
            return {
                loaded: true,
                val: null,
                error: "Geolocation not supported",
            };
        }
        return {
            loaded: false,
            val: null,
            error: null,
        };
    });

    const onSuccess = (position: GeolocationPosition) => {
        setLocation({
            loaded: true,
            val: {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
            },
            error: null,
        });
    };

    const onError = (error: GeolocationPositionError) => {
        setLocation({
            loaded: true,
            val: null,
            error: error.message,
        });
    };

    useEffect(() => {
        if (!("geolocation" in navigator)) return;
        navigator.geolocation.getCurrentPosition(onSuccess, onError);
    }, []);

    return location;
};

export default useGeolocation;
