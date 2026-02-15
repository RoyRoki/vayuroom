import { useEffect, useCallback, useRef } from 'react';
import {
    ref,
    push,
    set,
    remove,
    onChildAdded,
} from 'firebase/database';
import { db } from '../lib/firebase';
import type { CallSignal, CallSignalType } from '../types';
import { now } from '../lib/utils';

interface UseCallSignalingProps {
    roomHash: string;
    peerId: string;
    displayName: string;
    onIncomingCall: (signal: CallSignal) => void;
    onCallAnswered: (signal: CallSignal) => void;
    onCallRejected: (signal: CallSignal) => void;
    onCallEnded: (signal: CallSignal) => void;
}

export function useCallSignaling({
    roomHash,
    peerId,
    displayName,
    onIncomingCall,
    onCallAnswered,
    onCallRejected,
    onCallEnded,
}: UseCallSignalingProps) {
    /* ── Stable callback refs ── */
    const onIncomingCallRef = useRef(onIncomingCall);
    const onCallAnsweredRef = useRef(onCallAnswered);
    const onCallRejectedRef = useRef(onCallRejected);
    const onCallEndedRef = useRef(onCallEnded);

    useEffect(() => {
        onIncomingCallRef.current = onIncomingCall;
        onCallAnsweredRef.current = onCallAnswered;
        onCallRejectedRef.current = onCallRejected;
        onCallEndedRef.current = onCallEnded;
    }, [onIncomingCall, onCallAnswered, onCallRejected, onCallEnded]);

    /* ── Send a call signal ── */
    const sendCallSignal = useCallback(
        async (type: CallSignalType, callType: 'audio' | 'video' = 'audio', payload?: CallSignal['payload']) => {
            if (!roomHash) return;
            const callSignalRef = ref(db, `rooms/${roomHash}/callSignal`);
            const newRef = push(callSignalRef);
            const signal: CallSignal = {
                id: newRef.key!,
                type,
                senderId: peerId,
                senderName: displayName,
                callType,
                timestamp: now(),
            };
            // Only include payload if it has defined values (Firebase rejects undefined)
            if (payload) {
                const clean: Record<string, number> = {};
                for (const [k, v] of Object.entries(payload)) {
                    if (v !== undefined) clean[k] = v;
                }
                if (Object.keys(clean).length > 0) {
                    signal.payload = clean as CallSignal['payload'];
                }
            }
            await set(newRef, signal);
        },
        [roomHash, peerId, displayName]
    );

    /* ── Public API ── */
    const startCall = useCallback(
        (callType: 'audio' | 'video' = 'audio') => sendCallSignal('call-start', callType),
        [sendCallSignal]
    );

    const answerCall = useCallback(
        () => sendCallSignal('call-answer'),
        [sendCallSignal]
    );

    const rejectCall = useCallback(
        () => sendCallSignal('call-reject'),
        [sendCallSignal]
    );

    const endCall = useCallback(
        (duration?: number, startTime?: number, endTime?: number) =>
            sendCallSignal('call-end', 'audio', { duration, startTime, endTime }),
        [sendCallSignal]
    );

    /* ── Listen for call signals ── */
    useEffect(() => {
        if (!roomHash || !peerId) return;

        const callSignalPath = ref(db, `rooms/${roomHash}/callSignal`);

        const unsub = onChildAdded(callSignalPath, (snap) => {
            const signal = snap.val() as CallSignal;
            if (!signal || signal.senderId === peerId) return;

            // Ignore stale signals (older than 30s)
            if (now() - signal.timestamp > 30_000) {
                remove(snap.ref).catch(() => { });
                return;
            }

            switch (signal.type) {
                case 'call-start':
                    onIncomingCallRef.current(signal);
                    break;
                case 'call-answer':
                    onCallAnsweredRef.current(signal);
                    break;
                case 'call-reject':
                    onCallRejectedRef.current(signal);
                    break;
                case 'call-end':
                    onCallEndedRef.current(signal);
                    break;
            }

            // Clean up consumed signal
            remove(snap.ref).catch(() => { });
        });

        return () => unsub();
    }, [roomHash, peerId]);

    return {
        startCall,
        answerCall,
        rejectCall,
        endCall,
    };
}
