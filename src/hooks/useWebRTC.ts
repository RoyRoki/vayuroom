import { useRef, useCallback, useState, useEffect } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import {
    MAX_PEERS,
    ICE_RESTART_MAX,
    // SIGNAL_TTL_MS,
    // DATA_CHANNEL_LABEL
} from '../types';
import type { Signal, PresenceEntry } from '../types';

interface PeerConnection {
    pc: RTCPeerConnection;
    dc: RTCDataChannel | null;
    restartCount: number;
    makingOffer: boolean;
}

interface UseWebRTCProps {
    peerId: string;
    localStream: MediaStream | null;
    sendSignal: (signal: Omit<Signal, 'id' | 'timestamp' | 'politeness'>) => Promise<void>;
    joinOrder: number;
}

// Fallback ICE servers in case fetch fails
const fallbackIceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
];

// Mock fetchIceServers if not available
const fetchIceServers = async (): Promise<RTCIceServer[]> => {
    // In a real app, you'd fetch TURN servers here
    return fallbackIceServers;
};

export function useWebRTC({
    peerId,
    localStream,
    sendSignal,
    joinOrder,
}: UseWebRTCProps) {
    const connections = useRef<Map<string, PeerConnection>>(new Map());
    const iceServersRef = useRef<RTCIceServer[]>(fallbackIceServers);

    const addRemotePeer = useRoomStore((s) => s.addRemotePeer);
    const removeRemotePeer = useRoomStore((s) => s.removeRemotePeer);
    const updatePeerState = useRoomStore((s) => s.updatePeerState);
    const updatePeerStream = useRoomStore((s) => s.updatePeerStream);

    /* ── Init ICE servers ── */
    const initIceServers = useCallback(async () => {
        try {
            iceServersRef.current = await fetchIceServers();
        } catch {
            iceServersRef.current = fallbackIceServers;
        }
    }, []);

    /* ── Create PeerConnection ── */
    const createConnection = useCallback(
        (remotePeerId: string, remoteDisplayName: string) => {
            if (connections.current.size >= MAX_PEERS - 1) {
                console.warn(`[WebRTC] Room full — max ${MAX_PEERS} peers`);
                return null;
            }

            const pc = new RTCPeerConnection({
                iceServers: iceServersRef.current,
            });

            const entry: PeerConnection = {
                pc,
                dc: null,
                restartCount: 0,
                makingOffer: false,
            };

            // Add local tracks
            if (localStream) {
                localStream.getTracks().forEach((track) => {
                    pc.addTrack(track, localStream);
                });
            }

            // ICE candidates → send via signaling
            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    sendSignal({
                        type: 'candidate',
                        senderId: peerId,
                        targetId: remotePeerId,
                        payload: e.candidate.toJSON(),
                    });
                }
            };

            // Remote tracks
            pc.ontrack = (e) => {
                const [stream] = e.streams;
                if (stream) {
                    updatePeerStream(remotePeerId, stream);
                }
            };

            // Connection state changes
            pc.onconnectionstatechange = () => {
                updatePeerState(remotePeerId, pc.connectionState);

                if (pc.connectionState === 'failed') {
                    if (entry.restartCount < ICE_RESTART_MAX) {
                        entry.restartCount++;
                        console.log(`[WebRTC] ICE restart attempt ${entry.restartCount} for ${remotePeerId}`);
                        pc.restartIce();
                    } else {
                        console.error(`[WebRTC] Max ICE restarts reached for ${remotePeerId}`);
                        closeConnection(remotePeerId);
                    }
                }
            };

            // Auto-renegotiate when tracks are added/removed
            pc.onnegotiationneeded = async () => {
                try {
                    entry.makingOffer = true;
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    await sendSignal({
                        type: 'offer',
                        senderId: peerId,
                        targetId: remotePeerId,
                        payload: pc.localDescription!.toJSON(),
                    });
                } catch (err) {
                    console.error('[WebRTC] Negotiation needed failed:', err);
                } finally {
                    entry.makingOffer = false;
                }
            };

            connections.current.set(remotePeerId, entry);
            addRemotePeer(remotePeerId, remoteDisplayName);
            return entry;
        },
        [localStream, peerId, sendSignal, addRemotePeer, updatePeerState, updatePeerStream]
    );

    /* ── Handle incoming signals ── */
    const handleSignal = useCallback(
        async (signal: Signal) => {
            const { type, senderId, payload } = signal;

            if (type === 'leave') {
                closeConnection(senderId);
                return;
            }

            let entry = connections.current.get(senderId);

            if (type === 'offer') {
                // Polite peer protocol: if we're also making an offer
                if (entry?.makingOffer) {
                    // We are "polite" if our join order is higher (later joiner)
                    const weArePolite = joinOrder > signal.politeness;
                    if (!weArePolite) {
                        // We're impolite — ignore their offer
                        return;
                    }
                    // We're polite — rollback our offer and accept theirs
                }

                if (!entry) {
                    entry = createConnection(senderId, `User - ${senderId.slice(-4).toUpperCase()}`)!;
                    if (!entry) return;
                }

                const desc = payload as RTCSessionDescriptionInit;
                await entry.pc.setRemoteDescription(new RTCSessionDescription(desc));
                const answer = await entry.pc.createAnswer();
                await entry.pc.setLocalDescription(answer);

                await sendSignal({
                    type: 'answer',
                    senderId: peerId,
                    targetId: senderId,
                    payload: entry.pc.localDescription!.toJSON(),
                });
            }

            if (type === 'answer') {
                if (!entry) return;
                const desc = payload as RTCSessionDescriptionInit;
                await entry.pc.setRemoteDescription(new RTCSessionDescription(desc));
                entry.makingOffer = false;
            }

            if (type === 'candidate') {
                if (!entry) return;
                try {
                    const candidate = new RTCIceCandidate(payload as RTCIceCandidateInit);
                    await entry.pc.addIceCandidate(candidate);
                } catch (err) {
                    if (!entry.makingOffer) {
                        console.error('[WebRTC] Failed to add ICE candidate:', err);
                    }
                }
            }
        },
        [joinOrder, peerId, sendSignal, createConnection]
    );

    /* ── Initiate connection to a new peer ── */
    const connectToPeer = useCallback(
        async (remotePeerId: string, remoteDisplayName: string) => {
            let entry = connections.current.get(remotePeerId);
            if (!entry) {
                entry = createConnection(remotePeerId, remoteDisplayName)!;
                if (!entry) return;
            }

            // Create offer
            entry.makingOffer = true;
            const offer = await entry.pc.createOffer();
            await entry.pc.setLocalDescription(offer);

            await sendSignal({
                type: 'offer',
                senderId: peerId,
                targetId: remotePeerId,
                payload: entry.pc.localDescription!.toJSON(),
            });
        },
        [peerId, sendSignal, createConnection]
    );

    /* ── Handle peer join from presence ── */
    const handlePeerJoin = useCallback(
        (remotePeerId: string, entry: PresenceEntry) => {
            // Only the peer that joined earlier initiates the offer
            if (joinOrder < entry.order) {
                connectToPeer(remotePeerId, entry.displayName);
            }
            // Otherwise, wait for the other peer to send an offer
        },
        [joinOrder, connectToPeer]
    );

    /* ── Add tracks to all existing peers (for mid-session call start) ── */
    const addTracksToAllPeers = useCallback(
        (stream: MediaStream) => {
            connections.current.forEach((entry) => {
                const pc = entry.pc;
                const existingSenders = pc.getSenders();

                stream.getTracks().forEach((track) => {
                    // Check if a sender for this track kind already exists
                    const existingSender = existingSenders.find(
                        (s) => s.track?.kind === track.kind
                    );

                    if (existingSender) {
                        // Replace the track on the existing sender (no renegotiation needed)
                        existingSender.replaceTrack(track);
                    } else {
                        // Add new track — triggers onnegotiationneeded automatically
                        pc.addTrack(track, stream);
                    }
                });
            });
            console.log('[WebRTC] Added tracks to all peers');
        },
        []
    );

    /* ── Remove media tracks from all peers (for ending call) ── */
    const removeTracksFromAllPeers = useCallback(() => {
        connections.current.forEach((entry) => {
            const pc = entry.pc;
            const senders = pc.getSenders();
            senders.forEach((sender) => {
                if (sender.track) {
                    pc.removeTrack(sender);
                }
            });
        });
        console.log('[WebRTC] Removed tracks from all peers');
    }, []);

    /* ── Close one connection ── */
    const closeConnection = useCallback(
        (remotePeerId: string) => {
            const entry = connections.current.get(remotePeerId);
            if (entry) {
                entry.dc?.close();
                entry.pc.close();
                connections.current.delete(remotePeerId);
                removeRemotePeer(remotePeerId);
            }
        },
        [removeRemotePeer]
    );

    /* ── Close all connections ── */
    const closeAll = useCallback(() => {
        connections.current.forEach(({ pc, dc }) => {
            dc?.close();
            pc.close();
        });
        connections.current.clear();
    }, []);

    /* ── Connection Quality Polling ── */
    const [connectionQuality, setConnectionQuality] = useState<import('../types').ConnectionQuality>('unknown');

    useEffect(() => {
        const interval = setInterval(async () => {
            let hasConnected = false;
            let maxRtt = 0;
            let maxLoss = 0;

            for (const entry of connections.current.values()) {
                if (entry.pc.connectionState === 'connected') {
                    hasConnected = true;
                    try {
                        const stats = await entry.pc.getStats();
                        stats.forEach(report => {
                            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                                maxRtt = Math.max(maxRtt, report.currentRoundTripTime * 1000);
                            }
                            if (report.type === 'inbound-rtp' && (report.kind === 'video' || report.kind === 'audio')) {
                                if (report.packetsReceived > 0) {
                                    const loss = report.packetsLost / (report.packetsReceived + report.packetsLost);
                                    maxLoss = Math.max(maxLoss, loss);
                                }
                            }
                        });
                    } catch (e) {
                        console.warn('Failed to get stats', e);
                    }
                }
            }

            if (!hasConnected) {
                setConnectionQuality('unknown');
            } else if (maxRtt < 100 && maxLoss < 0.02) {
                setConnectionQuality('good');
            } else if (maxRtt < 400 && maxLoss < 0.10) {
                setConnectionQuality('fair');
            } else {
                setConnectionQuality('poor');
            }
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    return {
        initIceServers,
        handleSignal,
        handlePeerJoin,
        closeAll,
        connectToPeer,
        closeConnection,
        addTracksToAllPeers,
        removeTracksFromAllPeers,
        connectionQuality,
    };
}
