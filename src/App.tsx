import { useState, useCallback, useRef, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { JoinScreen } from './components/JoinScreen';
import { RoomScreen } from './components/RoomScreen';
import { useCrypto } from './hooks/useCrypto';
import { useSignaling } from './hooks/useSignaling';
import { useWebRTC } from './hooks/useWebRTC';
import { useMediaDevices } from './hooks/useMediaDevices';
import { useRoomStore } from './store/useRoomStore';
import { useChat } from './hooks/useChat';
import { generatePeerId } from './lib/utils';
import type { Signal, PresenceEntry } from './types';

type Screen = 'join' | 'room';

export default function App() {
    const [screen, setScreen] = useState<Screen>('join');
    const [isCallActive, setIsCallActive] = useState(false);
    const peerIdRef = useRef(generatePeerId());
    const displayNameRef = useRef(peerIdRef.current);

    const { derived, isLoading, derive, reset: resetCrypto } = useCrypto();
    const media = useMediaDevices();

    // Store Actions (Stable)
    const setRoomHash = useRoomStore(s => s.setRoomHash);
    const setConnectionStatus = useRoomStore(s => s.setConnectionStatus);
    const removeRemotePeer = useRoomStore(s => s.removeRemotePeer);
    const addRemotePeer = useRoomStore(s => s.addRemotePeer);
    const resetStore = useRoomStore(s => s.reset);
    const addSystemMessage = useRoomStore(s => s.addSystemMessage);

    /* ── Signaling callbacks ── */
    const handleSignalCb = useCallback((signal: Signal) => {
        webrtcRef.current?.handleSignal(signal);
    }, []);

    const handlePeerJoinCb = useCallback((peerId: string, entry: PresenceEntry) => {
        addSystemMessage(`${entry.displayName} joined the chat`);
        // Add to store immediately based on presence
        addRemotePeer(peerId, entry.displayName);
        webrtcRef.current?.handlePeerJoin(peerId, entry);
    }, [addRemotePeer]);

    const handlePeerLeaveCb = useCallback((peerId: string) => {
        addSystemMessage(`A peer left the chat`);
        removeRemotePeer(peerId);
    }, [removeRemotePeer]);

    const signaling = useSignaling({
        roomHash: derived?.roomHash ?? '',
        peerId: peerIdRef.current,
        displayName: displayNameRef.current,
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
            console.error('[App] Join failed:', err);
            toast.error('Failed to join room');
            setConnectionStatus('failed');
        }
    }, [derive, signaling, webrtcHook, setRoomHash, setConnectionStatus]);

    /* ── Leave Room ── */
    const handleLeave = useCallback(async () => {
        setIsCallActive(false);
        media.stopMedia();
        webrtcHook.closeAll();
        await signaling.leaveRoom();
        resetStore();
        resetCrypto();
        peerIdRef.current = generatePeerId();
        displayNameRef.current = peerIdRef.current;
        setScreen('join');
        toast('Left the room', { icon: '🚪' }); // Keep toast for leaving entirely since we are out of chat view
    }, [media, webrtcHook, signaling, resetStore, resetCrypto]);

    /* ── Duplicate Tab Detection ── */
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
                setScreen('join'); // Optional: force them back to join screen
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('storage', handleStorage);
        };
    }, [handleLeave]);

    /* ── Call toggle ── */
    const handleToggleCall = useCallback(async (startWithVideo = false) => {
        if (isCallActive) {
            // End call: remove tracks from peers, then stop media
            webrtcHook.removeTracksFromAllPeers();
            media.stopMedia();
            setIsCallActive(false);
        } else {
            try {
                // Start call (audio only or audio+video)
                const stream = await media.startMedia(startWithVideo);
                // Add tracks to all existing peer connections → triggers renegotiation
                webrtcHook.addTracksToAllPeers(stream);
                setIsCallActive(true);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Could not access media devices';
                toast.error(msg);
                console.error('[App] Media error:', err);
            }
        }
    }, [isCallActive, media, webrtcHook]);

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
                    connectionQuality={connectionQuality}
                    onSendMessage={chatHook.sendMessage}
                    onToggleAudio={media.toggleAudio}
                    onToggleVideo={media.toggleVideo}
                    onToggleCall={handleToggleCall}
                    onLeave={handleLeave}
                />
            )}
        </>
    );
}
