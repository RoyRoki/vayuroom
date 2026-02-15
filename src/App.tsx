import { useState, useCallback, useRef, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { JoinScreen } from './components/JoinScreen';
import { RoomScreen } from './components/RoomScreen';
import { useCrypto } from './hooks/useCrypto';
import { useSignaling } from './hooks/useSignaling';
import { useWebRTC } from './hooks/useWebRTC';
import { useMediaDevices } from './hooks/useMediaDevices';
import { useRoomStore } from './store/useRoomStore';
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
    const store = useRoomStore();

    /* ── Signaling callbacks ── */
    const handleSignalCb = useCallback((signal: Signal) => {
        webrtcRef.current?.handleSignal(signal);
    }, []);

    const handlePeerJoinCb = useCallback((peerId: string, entry: PresenceEntry) => {
        toast(`${entry.displayName} joined`, { icon: '👋' });
        webrtcRef.current?.handlePeerJoin(peerId, entry);
    }, []);

    const handlePeerLeaveCb = useCallback((peerId: string) => {
        toast(`A peer left the room`, { icon: '👋' });
        store.removeRemotePeer(peerId);
    }, []);

    const signaling = useSignaling({
        roomHash: derived?.roomHash ?? '',
        peerId: peerIdRef.current,
        displayName: displayNameRef.current,
        onSignal: handleSignalCb,
        onPeerJoin: handlePeerJoinCb,
        onPeerLeave: handlePeerLeaveCb,
    });

    /* ── WebRTC (stored in ref so callbacks don't go stale) ── */
    const webrtcHook = useWebRTC({
        peerId: peerIdRef.current,
        displayName: displayNameRef.current,
        aesKey: derived?.aesKey ?? ({} as CryptoKey),
        localStream: media.localStream,
        sendSignal: signaling.sendSignal,
        joinOrder: signaling.joinOrder,
    });

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

        store.setRoomHash(result.roomHash);
        store.setConnectionStatus('joining');

        try {
            await webrtcHook.initIceServers();
            await signaling.joinRoom();
            store.setConnectionStatus('connected');
            setScreen('room');
            toast.success('Joined room — encrypted & ephemeral');
        } catch (err) {
            console.error('[App] Join failed:', err);
            toast.error('Failed to join room');
            store.setConnectionStatus('failed');
        }
    }, [derive, signaling, webrtcHook, store]);

    /* ── Leave Room ── */
    const handleLeave = useCallback(async () => {
        setIsCallActive(false);
        media.stopMedia();
        webrtcHook.closeAll();
        await signaling.leaveRoom();
        store.reset();
        resetCrypto();
        peerIdRef.current = generatePeerId();
        displayNameRef.current = peerIdRef.current;
        setScreen('join');
        toast('Left the room', { icon: '🚪' });
    }, [media, webrtcHook, signaling, store, resetCrypto]);

    /* ── Call toggle ── */
    const handleToggleCall = useCallback(async () => {
        if (isCallActive) {
            media.stopMedia();
            setIsCallActive(false);
        } else {
            try {
                await media.startMedia(true);
                setIsCallActive(true);
                toast.success('Call started');
            } catch (err) {
                toast.error('Could not access microphone/camera');
                console.error('[App] Media error:', err);
            }
        }
    }, [isCallActive, media]);

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
                    onSendMessage={webrtcHook.sendMessage}
                    onToggleAudio={media.toggleAudio}
                    onToggleVideo={media.toggleVideo}
                    onToggleCall={handleToggleCall}
                    onLeave={handleLeave}
                />
            )}
        </>
    );
}
