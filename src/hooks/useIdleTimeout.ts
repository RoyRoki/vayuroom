import { useEffect, useRef } from 'react';
import { useRoomStore } from '../store/useRoomStore';

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function useIdleTimeout(onTimeout: () => void) {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onTimeoutRef = useRef(onTimeout);
    const connectionStatus = useRoomStore(s => s.connectionStatus);

    useEffect(() => {
        onTimeoutRef.current = onTimeout;
    }, [onTimeout]);

    useEffect(() => {
        if (connectionStatus !== 'connected') {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
        }

        const resetTimeout = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                onTimeoutRef.current();
            }, IDLE_TIMEOUT);
        };

        const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];

        // Initial start
        resetTimeout();

        const handleActivity = () => {
            resetTimeout();
        };

        events.forEach(event => {
            window.addEventListener(event, handleActivity);
        });

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [connectionStatus]);
}
