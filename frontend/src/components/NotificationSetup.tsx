import React, { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';

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
            <button
                onClick={toggleNotifications}
                className={`p-4 rounded-full shadow-lg transition-all transform hover:scale-105 ${enabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
            >
                {enabled ? <Bell className="text-white w-6 h-6" /> : <BellOff className="text-gray-400 w-6 h-6" />}
            </button>
        </div>
    );
};

export default NotificationSetup;
