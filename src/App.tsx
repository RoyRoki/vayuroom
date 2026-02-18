import { useState, useCallback, useRef, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { JoinScreen } from './components/JoinScreen';
import { RoomScreen } from './components/RoomScreen';
import { useCrypto } from './hooks/useCrypto';
import { useSignaling } from './hooks/useSignaling';
import { useWebRTC } from './hooks/useWebRTC';
import { useMediaDevices } from './hooks/useMediaDevices';
import { useCallSignaling } from './hooks/useCallSignaling';
import { useRoomStore } from './store/useRoomStore';
import { useChat } from './hooks/useChat';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { useSound } from './hooks/useSound';
import { generatePeerId } from './lib/utils';
import type { Signal, PresenceEntry, CallSignal } from './types';

type Screen = 'join' | 'room';

export default function App() {
    const [screen, setScreen] = useState<Screen>('join');
    const [isCallActive, setIsCallActive] = useState(false);
    const [isCallAnswered, setIsCallAnswered] = useState(false);
    const [activeCallType, setActiveCallType] = useState<'audio' | 'video' | null>(null);
    const peerIdRef = useRef(generatePeerId());
    const displayNameRef = useRef(peerIdRef.current);
    const callStartTimeRef = useRef<number | null>(null);
    const callerNameRef = useRef<string>('');

    const { derived, isLoading, derive, reset: resetCrypto } = useCrypto();
    const media = useMediaDevices();
    const { playSound } = useSound();

    // Store Actions (Stable)
    const setRoomHash = useRoomStore(s => s.setRoomHash);
    const setConnectionStatus = useRoomStore(s => s.setConnectionStatus);
    const removeRemotePeer = useRoomStore(s => s.removeRemotePeer);
    const addRemotePeer = useRoomStore(s => s.addRemotePeer);
    const resetStore = useRoomStore(s => s.reset);
    const addSystemMessage = useRoomStore(s => s.addSystemMessage);
    const setIncomingCall = useRoomStore(s => s.setIncomingCall);
    const addCallEventMessage = useRoomStore(s => s.addCallEventMessage);
    const roomCallStatus = useRoomStore(s => s.roomCallStatus);

    /* ── Signaling callbacks ── */
    const handleSignalCb = useCallback((signal: Signal) => {
        webrtcRef.current?.handleSignal(signal);
    }, []);

    const handlePeerJoinCb = useCallback((peerId: string, entry: PresenceEntry) => {
        addSystemMessage(`${entry.displayName} joined the chat`);
        playSound('join');
        // Add to store immediately based on presence
        addRemotePeer(peerId, entry.displayName);
        webrtcRef.current?.handlePeerJoin(peerId, entry);
    }, [addRemotePeer, playSound]);

    const handlePeerLeaveCb = useCallback((peerId: string) => {
        addSystemMessage(`A peer left the chat`);
        playSound('leave');
        // MUST close the WebRTC connection entry, otherwise the map fills up
        webrtcRef.current?.closeConnection(peerId);
        removeRemotePeer(peerId);
    }, [removeRemotePeer, playSound]);

    const signaling = useSignaling({
        roomHash: derived?.roomHash ?? '',
        peerId: peerIdRef.current,
        displayName: displayNameRef.current,
        aesKey: derived?.aesKey ?? null,
        onSignal: handleSignalCb,
        onPeerJoin: handlePeerJoinCb,
        onPeerLeave: handlePeerLeaveCb,
    });

    const chatHook = useChat({
        roomHash: derived?.roomHash ?? '',
        peerId: peerIdRef.current,
        displayName: displayNameRef.current,
        aesKey: derived?.aesKey ?? null,
    });

    /* ── WebRTC (stored in ref so callbacks don't go stale) ── */
    const webrtcHook = useWebRTC({
        peerId: peerIdRef.current,
        localStream: media.localStream,
        sendSignal: signaling.sendSignal,
        joinOrder: signaling.joinOrder,
    });
    const { connectionQuality } = webrtcHook;

    const webrtcRef = useRef(webrtcHook);
    useEffect(() => {
        webrtcRef.current = webrtcHook;
    }, [webrtcHook]);

    /* ── Call Signaling Callbacks ── */
    const handleIncomingCall = useCallback((signal: CallSignal) => {
        // Another peer started a call — show ringing
        playSound('call-incoming');
        setIncomingCall({
            callerId: signal.senderId,
            callerName: signal.senderName,
            callType: signal.callType,
            timestamp: signal.timestamp,
        });
    }, [setIncomingCall, playSound]);

    const handleCallAnswered = useCallback(async (signal: CallSignal) => {
        // Someone accepted our call — now the call is truly connected
        playSound('call-answered');
        setIsCallAnswered(true);
        // Use the timestamp from the signal (which might be from persistent state for late joiners)
        callStartTimeRef.current = signal.timestamp || Date.now();
        if (!isCallActive) {
            try {
                const isVideo = signal.callType === 'video';
                const stream = await media.startMedia(isVideo);
                webrtcHook.addTracksToAllPeers(stream);
                setIsCallActive(true);
                setActiveCallType(signal.callType);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Could not access media devices';
                toast.error(msg);
            }
        } else {
            // Already active — just record the start time if not set
            if (!callStartTimeRef.current) {
                callStartTimeRef.current = Date.now();
            }
            setIsCallAnswered(true);
        }
    }, [isCallActive, media, webrtcHook, playSound]);

    const endCallRef = useRef<((duration?: number, startTime?: number, endTime?: number) => Promise<void>) | null>(null);

    const handleCallRejected = useCallback(async (signal: CallSignal) => {
        // Someone declined our call
        playSound('call-declined');
        if (isCallActive) {
            if (endCallRef.current) {
                await endCallRef.current();
            }

            webrtcHook.removeTracksFromAllPeers();
            media.stopMedia();
            setIsCallActive(false);
            setActiveCallType(null);
            setIsCallAnswered(false);

            addCallEventMessage({
                callerName: displayNameRef.current,
                callStatus: 'declined',
                callStartTime: undefined,
                callEndTime: undefined,
            });

            toast(`${signal.senderName} declined the call`, { icon: '📵' });
        }
        setIncomingCall(null);
        callStartTimeRef.current = null;
        callerNameRef.current = '';
    }, [isCallActive, media, webrtcHook, addCallEventMessage, setIncomingCall, playSound]);

    const handleCallEnded = useCallback((signal: CallSignal) => {
        // Remote peer ended the call
        playSound('call-end');
        if (isCallActive) {
            const endTime = Date.now();
            const startTime = callStartTimeRef.current || endTime;
            const duration = Math.floor((endTime - startTime) / 1000);

            webrtcHook.removeTracksFromAllPeers();
            media.stopMedia();
            setIsCallActive(false);
            setActiveCallType(null);
            setIsCallAnswered(false);

            addCallEventMessage({
                callerName: signal.senderName || callerNameRef.current || 'Unknown',
                callStatus: duration > 0 ? 'completed' : 'missed',
                callStartTime: startTime,
                callEndTime: endTime,
                callDuration: duration,
            });
        }
        setIncomingCall(null);
        callStartTimeRef.current = null;
        callerNameRef.current = '';
    }, [isCallActive, media, webrtcHook, addCallEventMessage, setIncomingCall, playSound]);

    const callSignaling = useCallSignaling({
        roomHash: derived?.roomHash ?? '',
        peerId: peerIdRef.current,
        displayName: displayNameRef.current,
        onIncomingCall: handleIncomingCall,
        onCallAnswered: handleCallAnswered,
        onCallRejected: handleCallRejected,
        onCallEnded: handleCallEnded,
    });

    // Break circular dependency
    useEffect(() => {
        endCallRef.current = callSignaling.endCall;
    }, [callSignaling.endCall]);

    /* ── Join Room ── */
    const handleJoin = useCallback(async (passphrase: string) => {
        const result = await derive(passphrase);
        if (!result) {
            toast.error('Failed to derive encryption key');
            return;
        }

        setRoomHash(result.roomHash);
        setConnectionStatus('joining');

        try {
            await webrtcHook.initIceServers();
            await signaling.joinRoom(result.roomHash);
            setConnectionStatus('connected');
            setScreen('room');
            addSystemMessage('You joined the room');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to join room';
            console.error('[App] Join failed:', msg);
            if (msg === 'Room is full') {
                toast.error('Room is full (max 3 participants). Try again later.');
            } else {
                toast.error('Failed to join room');
            }
            setConnectionStatus('failed');
        }
    }, [derive, signaling, webrtcHook, setRoomHash, setConnectionStatus]);

    /* ── Leave Room ── */
    const handleLeave = useCallback(async () => {
        // Last Man Standing Check: If I'm the last one and there's a call state, clear it
        const currentPeerCount = useRoomStore.getState().peerCount;
        const currentRoomCallStatus = useRoomStore.getState().roomCallStatus;

        if (currentPeerCount <= 1 && currentRoomCallStatus !== 'idle') {
            // Force clear the call state
            await callSignaling.endCall();
        }

        setIsCallActive(false);
        setActiveCallType(null);
        setIsCallAnswered(false);
        setIncomingCall(null);
        callStartTimeRef.current = null;
        callerNameRef.current = '';
        media.stopMedia();
        webrtcHook.closeAll();

        try {
            // Check if I am the last one (peerCount includes me, so <= 1 means just me)
            const currentPeerCount = useRoomStore.getState().peerCount;
            const isLastUser = currentPeerCount <= 1;

            if (isLastUser) {
                console.log('Last user leaving - destroying room...');
                await signaling.destroyRoom();
            } else {
                await signaling.leaveRoom();
            }
        } catch (e) {
            console.warn('Failed to leave room cleanly', e);
        }

        resetStore();
        resetCrypto();

        // ── Clean Exit ──
        localStorage.clear();
        sessionStorage.clear();

        // Use replace to ensure no back-button history to the room
        window.location.replace('https://google.com');
        // Or if you prefer to stay in app but clean: 
        // window.location.reload(); 

        // But user requested "cleanup", so navigation away is safer for "tracks".
        // toast('Left the room', { icon: '🚪' }); // Won't be seen if we redirect
    }, [isCallActive, callSignaling, media, webrtcHook, signaling, resetStore, resetCrypto, setIncomingCall]);

    /* ── Duplicate Tab Detection ── */
    useIdleTimeout(handleLeave);

    useEffect(() => {
        const SESSION_KEY = 'vayuroom_session_id';
        const mySessionId = crypto.randomUUID();

        // Claim lock
        localStorage.setItem(SESSION_KEY, mySessionId);

        const handleStorage = (e: StorageEvent) => {
            if (e.key === SESSION_KEY && e.newValue !== mySessionId) {
                // Another tab took over
                toast.error('You opened Vroom in another tab. Disconnecting this one.', { duration: 10000 });
                handleLeave();
                setScreen('join');
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('storage', handleStorage);
        };
    }, [handleLeave]);

    /* ── Start Call (caller initiates) ── */
    const handleToggleCall = useCallback(async (startWithVideo = false) => {
        if (isCallActive) {
            // End call
            playSound('call-end');
            const endTime = Date.now();
            const startTime = callStartTimeRef.current || endTime;
            const duration = Math.floor((endTime - startTime) / 1000);

            await callSignaling.endCall(duration, startTime, endTime);
            webrtcHook.removeTracksFromAllPeers();
            media.stopMedia();
            setIsCallActive(false);
            setActiveCallType(null);
            setIsCallAnswered(false);

            addCallEventMessage({
                callerName: callerNameRef.current || displayNameRef.current,
                callStatus: duration > 0 ? 'completed' : 'missed',
                callStartTime: startTime,
                callEndTime: endTime,
                callDuration: duration,
            });

            callStartTimeRef.current = null;
            callerNameRef.current = '';
        } else {
            try {
                // If call is already active in room, we join it (Split Brain Fix)
                if (roomCallStatus === 'active') {
                    const stream = await media.startMedia(startWithVideo);
                    webrtcHook.addTracksToAllPeers(stream);
                    setIsCallActive(true);
                    setActiveCallType(startWithVideo ? 'video' : 'audio');
                    // We don't call startCall or answerCall. 
                    // We just join the media. Call state is already active.
                    // We assume startTime is already set by the original caller/answerer.
                    // (Optionally fetch it from firebase if we want accurate timer for late joiner, 
                    // but App.tsx currently relies on local or signaled timestamp)

                    addSystemMessage('Joined the active call');
                    return;
                }

                // Start call: get media, add tracks, send call-start signal
                const stream = await media.startMedia(startWithVideo);
                webrtcHook.addTracksToAllPeers(stream);
                callerNameRef.current = displayNameRef.current;
                setIsCallActive(true);
                setActiveCallType(startWithVideo ? 'video' : 'audio');
                // Don't set callStartTimeRef here — timer starts when someone answers

                // Notify other peers
                await callSignaling.startCall(startWithVideo ? 'video' : 'audio');

                addSystemMessage(`${displayNameRef.current} started audio calling`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Could not access media devices';
                toast.error(msg);
                console.error('[App] Media error:', err);
            }
        }
    }, [isCallActive, media, webrtcHook, callSignaling, addSystemMessage, addCallEventMessage, roomCallStatus, playSound]);

    /* ── Accept incoming call ── */
    const handleAcceptCall = useCallback(async () => {
        try {
            playSound('call-answered');
            const incomingCall = useRoomStore.getState().incomingCall;
            const isVideo = incomingCall?.callType === 'video';
            callerNameRef.current = incomingCall?.callerName || '';

            const stream = await media.startMedia(isVideo);
            webrtcHook.addTracksToAllPeers(stream);
            callStartTimeRef.current = Date.now();
            setIsCallActive(true);
            setActiveCallType(incomingCall?.callType || 'audio');
            setIsCallAnswered(true);
            setIncomingCall(null);

            await callSignaling.answerCall();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Could not access media devices';
            toast.error(msg);
        }
    }, [media, webrtcHook, callSignaling, setIncomingCall, playSound]);

    /* ── Decline incoming call ── */
    const handleDeclineCall = useCallback(async () => {
        playSound('call-declined');
        const incomingCall = useRoomStore.getState().incomingCall;
        setIncomingCall(null);

        await callSignaling.rejectCall();

        addCallEventMessage({
            callerName: incomingCall?.callerName || 'Unknown',
            callStatus: 'missed',
        });
    }, [callSignaling, setIncomingCall, addCallEventMessage, playSound]);

    /* ── Toggle Audio with Sound ── */
    const handleToggleAudio = useCallback(async () => {
        playSound(media.isAudioEnabled ? 'mic-off' : 'mic-on');
        await media.toggleAudio();
    }, [media, playSound]);

    /* ── Toggle Video & Update Peers ── */
    const handleToggleVideo = useCallback(async () => {
        playSound(media.isVideoEnabled ? 'cam-off' : 'cam-on');
        await media.toggleVideo();
        if (media.localStream) {
            webrtcHook.addTracksToAllPeers(media.localStream);
        }
    }, [media, webrtcHook, playSound]);

    /* ── Switch Camera ── */
    const handleSwitchCamera = useCallback(async () => {
        playSound('cam-flip');
        const newStream = await media.switchCamera();
        if (newStream) {
            webrtcHook.addTracksToAllPeers(newStream);
        }
    }, [media, webrtcHook, playSound]);

    /* ── Toggle Screen Share ── */
    const handleToggleScreenShare = useCallback(async () => {
        if (media.isScreenSharing) {
            playSound('cam-off'); // or a different sound?
            const stream = await media.stopScreenShare();
            if (stream) {
                webrtcHook.addTracksToAllPeers(stream);
            }
        } else {
            playSound('cam-on');
            const stream = await media.startScreenShare();
            if (stream) {
                webrtcHook.addTracksToAllPeers(stream);
            } else {
                // Failed to start screen share (user cancelled or not supported)
                toast.error('Failed to start screen share');
            }
        }
    }, [media, webrtcHook, playSound]);

    /* ── Outgoing Call Ringback ── */
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (roomCallStatus === 'ringing' && isCallActive && !isCallAnswered) {
            // We are the caller (or at least in the call while it's ringing)
            // Play ringback tone every 2.5s
            const playRingback = () => playSound('call-outgoing');
            playRingback();
            interval = setInterval(playRingback, 2500);
        }
        return () => clearInterval(interval);
    }, [roomCallStatus, isCallActive, isCallAnswered, playSound]);

    return (
        <>
            <Toaster
                position="top-center"
                toastOptions={{
                    style: {
                        background: '#262626',
                        color: '#F5F5F5',
                        fontSize: '14px',
                        borderRadius: '12px',
                        border: '1px solid #363636',
                    },
                    duration: 3000,
                }}
            />

            {screen === 'join' && (
                <JoinScreen onJoin={handleJoin} isLoading={isLoading} />
            )}

            {screen === 'room' && (
                <RoomScreen
                    localPeerId={peerIdRef.current}
                    localStream={media.localStream}
                    isAudioEnabled={media.isAudioEnabled}
                    isVideoEnabled={media.isVideoEnabled}
                    isCallActive={isCallActive}
                    isCallAnswered={isCallAnswered}
                    activeCallType={activeCallType}
                    connectionQuality={connectionQuality}
                    onSendMessage={chatHook.sendMessage}
                    onToggleAudio={handleToggleAudio}
                    onToggleVideo={handleToggleVideo}
                    onSwitchCamera={handleSwitchCamera}
                    onToggleCall={handleToggleCall}
                    onAcceptCall={handleAcceptCall}
                    onDeclineCall={handleDeclineCall}
                    onLeave={handleLeave}
                    callStartTime={callStartTimeRef.current ?? undefined}
                    isScreenSharing={media.isScreenSharing}
                    isScreenShareSupported={media.isScreenShareSupported}
                    onToggleScreenShare={handleToggleScreenShare}
                />
            )}
        </>
    );
}

