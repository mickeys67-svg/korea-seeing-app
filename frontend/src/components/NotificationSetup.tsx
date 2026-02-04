import React, { useState } from 'react';

const NotificationSetup: React.FC = () => {
    const [enabled, setEnabled] = useState(false);

    const toggleNotifications = () => {
        // Logic to request notification permission and subscribe to push
        if (!enabled) {
            if ('Notification' in window) {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        setEnabled(true);
                        // TODO: Subscribe to Web Push here
                        alert("Notifications enabled! (This is a simplified demo)");
                    }
                });
            }
        } else {
            setEnabled(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6">
            {/* Toggle Switch */}
            <button
                onClick={toggleNotifications}
                className="relative inline-flex items-center cursor-pointer p-2 rounded-full hover:bg-gray-700/50 transition-colors"
                aria-label="Toggle Notifications"
            >
                <div className={`w-14 h-8 rounded-full peer transition-colors duration-300 ${enabled ? 'bg-blue-600' : 'bg-gray-600'}`}></div>
                <div className={`absolute left-3 top-3 bg-white border border-gray-300 rounded-full h-6 w-6 transition-transform duration-300 ${enabled ? 'translate-x-6 border-white' : ''}`}></div>
            </button>
        </div>
    );
};

export default NotificationSetup;
