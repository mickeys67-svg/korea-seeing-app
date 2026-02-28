import React, { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';

const NotificationSetup: React.FC = () => {
    const [enabled, setEnabled] = useState(false);

    const toggleNotifications = () => {
        if (!enabled) {
            if ('Notification' in window) {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        setEnabled(true);
                    }
                });
            }
        } else {
            setEnabled(false);
        }
    };

    return (
        <button
            onClick={toggleNotifications}
            className="fixed bottom-5 right-5 p-3 rounded-full glass-card border border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] transition-all hover:scale-105 active:scale-95 shadow-lg"
            aria-label="Toggle Notifications"
            title={enabled ? 'Disable notifications' : 'Enable notifications'}
        >
            {enabled ? (
                <Bell className="w-4 h-4 text-[var(--accent)]" />
            ) : (
                <BellOff className="w-4 h-4 text-[var(--text-tertiary)]" />
            )}
        </button>
    );
};

export default NotificationSetup;
