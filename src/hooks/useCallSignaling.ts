import { useEffect, useCallback, useRef } from 'react';
import {
    ref,
    push,
    set,
    remove,
    onChildAdded,
    onValue,
    get,
} from 'firebase/database';
import { db } from '../lib/firebase';
import type { CallSignal, CallState } from '../types';
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

    /* ── Actions ── */
    const startCall = useCallback(
        async (callType: 'audio' | 'video' = 'audio') => {
            if (!roomHash) return;
            const stateRef = ref(db, `rooms/${roomHash}/callState`);
            const state: CallState = {
                status: 'ringing',
                callerId: peerId,
                callerName: displayName,
                callType,
                startTime: now(),
            };
            await set(stateRef, state);
        },
        [roomHash, peerId, displayName]
    );

    const answerCall = useCallback(
        async () => {
            if (!roomHash) return;
            const stateRef = ref(db, `rooms/${roomHash}/callState`);
            // We need to preserve original caller info, so update status only
            const snapshot = await get(stateRef);
            if (snapshot.exists()) {
                const existing = snapshot.val() as CallState;
                await set(stateRef, {
                    ...existing,
                    status: 'active',
                    startTime: now(), // Update start time to answer time
                });
            }
        },
        [roomHash]
    );

    const rejectCall = useCallback(
        async () => {
            if (!roomHash) return;
            // Reject is transient — just a signal
            const signalsRef = ref(db, `rooms/${roomHash}/callSignal`);
            const newRef = push(signalsRef);
            const signal: CallSignal = {
                id: newRef.key!,
                type: 'call-reject',
                senderId: peerId,
                senderName: displayName,
                callType: 'audio',
                timestamp: now(),
            };
            await set(newRef, signal);
        },
        [roomHash, peerId, displayName]
    );

    const endCall = useCallback(
        async (duration?: number, startTime?: number, endTime?: number) => {
            if (!roomHash) return;

            // 1. Remove persistent state
            const stateRef = ref(db, `rooms/${roomHash}/callState`);
            await remove(stateRef);

            // 2. Send transient signal for immediate notification/logging
            const signalsRef = ref(db, `rooms/${roomHash}/callSignal`);
            const newRef = push(signalsRef);
            const signal: CallSignal = {
                id: newRef.key!,
                type: 'call-end',
                senderId: peerId,
                senderName: displayName,
                callType: 'audio',
                timestamp: now(),
                payload: { duration, startTime, endTime }
            };
            await set(newRef, signal);
        },
        [roomHash, peerId, displayName]
    );

    /* ── Listeners ── */
    useEffect(() => {
        if (!roomHash || !peerId) return;

        const callStateRef = ref(db, `rooms/${roomHash}/callState`);
        const callSignalRef = ref(db, `rooms/${roomHash}/callSignal`);

        // 1. Listen for persistent state changes (Handle Start/Answer/Late Join)
        const unsubState = onValue(callStateRef, (snapshot) => {
            const state = snapshot.val() as CallState | null;

            if (!state) {
                // Call ended or cleared.
                // We rely on 'call-end' signal for explicit ending, but this is a fallback
                // If we are in 'active' state locally, this should ensure we cleanup
                // But App.tsx doesn't expose 'isCallActive' here.
                // We'll leave explicit 'call-end' signal to handle the UI/Cleanup.
                return;
            }

            // Synthesize signal from state
            const signal: CallSignal = {
                id: 'persistent',
                senderId: state.callerId,
                senderName: state.callerName,
                callType: state.callType,
                timestamp: state.startTime,
                type: state.status === 'ringing' ? 'call-start' : 'call-answer'
            };

            if (state.status === 'ringing') {
                // Don't notify if we are the caller
                if (state.callerId !== peerId) {
                    onIncomingCallRef.current(signal);
                }
            } else if (state.status === 'active') {
                onCallAnsweredRef.current(signal);
            }
        });

        // 2. Listen for transient signals (Reject / End)
        const unsubSignals = onChildAdded(callSignalRef, (snap) => {
            const signal = snap.val() as CallSignal;
            if (!signal || signal.senderId === peerId) return;

            // Ignore stale signals (>30s)
            if (now() - signal.timestamp > 30_000) {
                remove(snap.ref).catch(() => { });
                return;
            }

            if (signal.type === 'call-reject') {
                onCallRejectedRef.current(signal);
            } else if (signal.type === 'call-end') {
                onCallEndedRef.current(signal);
            }

            // Clean up consumed signal
            remove(snap.ref).catch(() => { });
        });

        return () => {
            unsubState();
            unsubSignals();
        };
    }, [roomHash, peerId]);


    return {
        startCall,
        answerCall,
        rejectCall,
        endCall,
    };
}
