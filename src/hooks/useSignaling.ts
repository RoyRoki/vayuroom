import { useEffect, useCallback, useRef } from 'react';
import {
    ref,
    push,
    set,
    get,
    remove,
    onChildAdded,
    onChildRemoved,
    onDisconnect,
} from 'firebase/database';
import { db } from '../lib/firebase';
import type { Signal, PresenceEntry } from '../types';
import { HEARTBEAT_INTERVAL, PRESENCE_STALE_MS, MAX_PEERS } from '../types';
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
    const staleCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const joinOrderRef = useRef(0);
    const activeRoomRef = useRef('');

    /* ── Presence ── */
    const joinRoom = useCallback(async (overrideRoomHash?: string) => {
        const targetHash = overrideRoomHash || roomHash;
        if (!targetHash) {
            console.error('[Signaling] Cannot join room: No room hash');
            return;
        }

        // Clean stale peers BEFORE checking capacity
        await cleanStalePeers(targetHash);

        // Check room capacity after cleaning
        const presencePath = ref(db, `rooms/${targetHash}/presence`);
        const snapshot = await get(presencePath);
        const currentCount = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        if (currentCount >= MAX_PEERS) {
            throw new Error('Room is full');
        }

        const presenceRef = ref(db, `rooms/${targetHash}/presence/${peerId}`);
        const presenceData: PresenceEntry = {
            displayName,
            timestamp: now(),
            order: now(),
        };

        // Set presence
        await set(presenceRef, presenceData);
        joinOrderRef.current = presenceData.order;
        activeRoomRef.current = targetHash;

        // Auto-remove on disconnect (Firebase server-side, best-effort)
        onDisconnect(presenceRef).remove();

        // Heartbeat: update timestamp every 10s
        heartbeatRef.current = setInterval(async () => {
            try {
                await set(ref(db, `rooms/${targetHash}/presence/${peerId}/timestamp`), now());
            } catch {
                // ignore heartbeat errors
            }
        }, HEARTBEAT_INTERVAL);

        // Stale peer cleanup: scan every 20s and remove dead peers
        staleCleanupRef.current = setInterval(async () => {
            await cleanStalePeers(targetHash);
        }, HEARTBEAT_INTERVAL * 2);

    }, [roomHash, peerId, displayName]);

    /** Remove peers whose timestamp is older than PRESENCE_STALE_MS */
    const cleanStalePeers = async (targetHash: string) => {
        try {
            const presencePath = ref(db, `rooms/${targetHash}/presence`);
            const snapshot = await get(presencePath);
            if (!snapshot.exists()) return;

            const peers = snapshot.val() as Record<string, PresenceEntry>;
            const currentTime = now();

            for (const [id, entry] of Object.entries(peers)) {
                if (id === peerId) continue; // Don't clean ourselves
                const age = currentTime - entry.timestamp;
                if (age > PRESENCE_STALE_MS) {
                    console.log(`[Signaling] Cleaning stale peer ${id} (age: ${Math.round(age / 1000)}s)`);
                    await remove(ref(db, `rooms/${targetHash}/presence/${id}`));
                    // onChildRemoved will fire and trigger onPeerLeave
                }
            }
        } catch (err) {
            console.warn('[Signaling] Stale cleanup failed:', err);
        }
    };

    const leaveRoom = useCallback(async () => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
        if (staleCleanupRef.current) {
            clearInterval(staleCleanupRef.current);
            staleCleanupRef.current = null;
        }
        try {
            await remove(ref(db, `rooms/${roomHash}/presence/${peerId}`));
            await remove(ref(db, `rooms/${roomHash}/signals`));
        } catch {
            // best-effort cleanup
        }
        activeRoomRef.current = '';
    }, [roomHash, peerId]);

    /* ── beforeunload / pagehide: best-effort cleanup on tab close ── */
    useEffect(() => {
        const cleanup = () => {
            const hash = activeRoomRef.current;
            if (!hash) return;
            // Use sendBeacon for reliable tab-close cleanup
            // But Firebase doesn't support beacon, so use synchronous remove
            try {
                // Best-effort: remove presence. Firebase onDisconnect should also handle this.
                const presenceRef = ref(db, `rooms/${hash}/presence/${peerId}`);
                remove(presenceRef).catch(() => { });
            } catch {
                // ignore
            }
        };

        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('pagehide', cleanup);

        return () => {
            window.removeEventListener('beforeunload', cleanup);
            window.removeEventListener('pagehide', cleanup);
        };
    }, [peerId]);

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
    const onSignalRef = useRef(onSignal);
    const onPeerJoinRef = useRef(onPeerJoin);
    const onPeerLeaveRef = useRef(onPeerLeave);

    useEffect(() => {
        onSignalRef.current = onSignal;
        onPeerJoinRef.current = onPeerJoin;
        onPeerLeaveRef.current = onPeerLeave;
    }, [onSignal, onPeerJoin, onPeerLeave]);

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
                onPeerJoinRef.current(id, entry);
            }
        });

        // Listen for peers leaving
        const unsubLeave = onChildRemoved(presencePath, (snap) => {
            const id = snap.key;
            if (id && id !== peerId) {
                onPeerLeaveRef.current(id);
            }
        });

        // Listen for signals directed at us
        const unsubSignals = onChildAdded(signalsPath, (snap) => {
            const signal = snap.val() as Signal;
            if (!signal || signal.senderId === peerId) return;
            if (signal.targetId && signal.targetId !== peerId) return;

            // Ignore expired signals
            if (now() - signal.timestamp > 60_000) {
                remove(snap.ref).catch(() => { });
                return;
            }

            onSignalRef.current(signal);
            remove(snap.ref).catch(() => { });
        });

        return () => {
            unsubJoin();
            unsubLeave();
            unsubSignals();
        };
    }, [roomHash, peerId]);

    return {
        joinRoom,
        leaveRoom,
        sendSignal,
        joinOrder: joinOrderRef.current,
    };
}

