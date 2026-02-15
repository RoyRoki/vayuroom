import { useEffect, useCallback, useRef } from 'react';
import {
    ref,
    push,
    set,
    remove,
    onChildAdded,
    onChildRemoved,
    onDisconnect,
} from 'firebase/database';
import { db } from '../lib/firebase';
import type { Signal, PresenceEntry } from '../types';
import { HEARTBEAT_INTERVAL, PRESENCE_STALE_MS } from '../types';
import { now } from '../lib/utils';

interface UseSignalingProps {
    roomHash: string;
    peerId: string;
    displayName: string;
    onSignal: (signal: Signal) => void;
    onPeerJoin: (peerId: string, entry: PresenceEntry) => void;
    onPeerLeave: (peerId: string) => void;
}

export function useSignaling({
    roomHash,
    peerId,
    displayName,
    onSignal,
    onPeerJoin,
    onPeerLeave,
}: UseSignalingProps) {
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const joinOrderRef = useRef(0);

    /* ── Presence ── */
    const joinRoom = useCallback(async () => {
        const presenceRef = ref(db, `rooms/${roomHash}/presence/${peerId}`);
        const presenceData: PresenceEntry = {
            displayName,
            timestamp: now(),
            order: now(), // join order = timestamp (lower = more impolite)
        };

        // Set presence
        await set(presenceRef, presenceData);
        joinOrderRef.current = presenceData.order;

        // Auto-remove on disconnect
        onDisconnect(presenceRef).remove();

        // Heartbeat: update timestamp every 15s
        heartbeatRef.current = setInterval(async () => {
            try {
                await set(ref(db, `rooms/${roomHash}/presence/${peerId}/timestamp`), now());
            } catch {
                // ignore heartbeat errors
            }
        }, HEARTBEAT_INTERVAL);
    }, [roomHash, peerId, displayName]);

    const leaveRoom = useCallback(async () => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
        try {
            await remove(ref(db, `rooms/${roomHash}/presence/${peerId}`));
            await remove(ref(db, `rooms/${roomHash}/signals`));
        } catch {
            // best-effort cleanup
        }
    }, [roomHash, peerId]);

    /* ── Send Signal ── */
    const sendSignal = useCallback(
        async (signal: Omit<Signal, 'id' | 'timestamp' | 'politeness'>) => {
            const signalsRef = ref(db, `rooms/${roomHash}/signals`);
            const newRef = push(signalsRef);
            const fullSignal: Signal = {
                ...signal,
                id: newRef.key!,
                timestamp: now(),
                politeness: joinOrderRef.current,
            };
            await set(newRef, fullSignal);
        },
        [roomHash]
    );

    /* ── Listen for peer presence + signals ── */
    useEffect(() => {
        if (!roomHash || !peerId) return;

        const presencePath = ref(db, `rooms/${roomHash}/presence`);
        const signalsPath = ref(db, `rooms/${roomHash}/signals`);

        // Listen for peers joining
        const unsubJoin = onChildAdded(presencePath, (snap) => {
            const id = snap.key;
            if (!id || id === peerId) return;
            const entry = snap.val() as PresenceEntry;
            // Ignore stale peers
            if (now() - entry.timestamp < PRESENCE_STALE_MS) {
                onPeerJoin(id, entry);
            }
        });

        // Listen for peers leaving
        const unsubLeave = onChildRemoved(presencePath, (snap) => {
            const id = snap.key;
            if (id && id !== peerId) {
                onPeerLeave(id);
            }
        });

        // Listen for signals directed at us
        const unsubSignals = onChildAdded(signalsPath, (snap) => {
            const signal = snap.val() as Signal;
            if (!signal || signal.senderId === peerId) return;
            if (signal.targetId && signal.targetId !== peerId) return;

            // Ignore expired signals
            if (now() - signal.timestamp > 60_000) {
                // Clean up stale signal
                remove(snap.ref).catch(() => { });
                return;
            }

            onSignal(signal);
            // Remove consumed signal
            remove(snap.ref).catch(() => { });
        });

        return () => {
            unsubJoin();
            unsubLeave();
            unsubSignals();
        };
    }, [roomHash, peerId, onSignal, onPeerJoin, onPeerLeave]);

    return {
        joinRoom,
        leaveRoom,
        sendSignal,
        joinOrder: joinOrderRef.current,
    };
}
