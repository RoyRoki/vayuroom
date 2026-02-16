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
            // If connection already exists for this peer, return it
            const existing = connections.current.get(remotePeerId);
            if (existing) {
                if (existing.pc.connectionState !== 'closed' && existing.pc.connectionState !== 'failed') {
                    console.log(`[WebRTC] Reusing existing connection for ${remotePeerId}`);
                    return existing;
                }
                // Connection is dead — clean it up
                existing.dc?.close();
                existing.pc.close();
                connections.current.delete(remotePeerId);
            }

            // Clean up any dead connections before checking capacity
            for (const [id, entry] of connections.current.entries()) {
                const state = entry.pc.connectionState;
                if (state === 'closed' || state === 'failed' || state === 'disconnected') {
                    console.log(`[WebRTC] Cleaning dead connection for ${id} (state: ${state})`);
                    entry.dc?.close();
                    entry.pc.close();
                    connections.current.delete(id);
                    removeRemotePeer(id);
                }
            }

            if (connections.current.size >= MAX_PEERS - 1) {
                console.warn(`[WebRTC] Room full — max ${MAX_PEERS} peers (connections: ${connections.current.size})`);
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
                console.log(`[WebRTC] ontrack from ${remotePeerId}:`, e.track.kind, 'streams:', e.streams.length);
                const firstStream = e.streams?.[0];
                const stream = firstStream ?? new MediaStream([e.track]);
                if (!firstStream) {
                    console.warn(`[WebRTC] No stream in ontrack, created new MediaStream for ${remotePeerId}`);
                }
                updatePeerStream(remotePeerId, stream);
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

                // If connection is already stable, we might be receiving a duplicate offer or a glare.
                // But if we are polite and they are making an offer, we should accept it (renegotiation).
                // However, if we just set an answer (makingOffer=false), we might be in stable state.

                const desc = payload as RTCSessionDescriptionInit;
                if (entry.pc.signalingState !== 'stable' || entry.pc.signalingState === 'stable') {
                    // Actually, if it is stable, we CAN set remote offer (it triggers renegotiation).
                    // The error "Failed to set remote answer sdp: Called in wrong state: stable" 
                    // means we are trying to set an ANSWER when the state is STABLE 
                    // (which implies we didn't set a local offer, or we already processed an answer).

                    // Wait, the error loop says "setRemoteDescription ... Failed to set remote ANSWER".
                    // This means we are processing an ANSWER signal.
                }

                // ... (offer logic continues)
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
                // Fix: Check if we are actually waiting for an answer
                if (entry.pc.signalingState === 'stable') {
                    console.warn('[WebRTC] Ignored answer because connection is already stable');
                    return;
                }
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
        async (stream: MediaStream) => {
            for (const [remotePeerId, entry] of connections.current.entries()) {
                const pc = entry.pc;

                stream.getTracks().forEach((track) => {
                    // 1. Check for existing sender with a track of the same kind
                    const senderWithTrack = pc.getSenders().find(
                        (s) => s.track?.kind === track.kind
                    );

                    if (senderWithTrack) {
                        senderWithTrack.replaceTrack(track);
                        console.log(`[WebRTC] Replaced ${track.kind} track for ${remotePeerId}`);
                        return;
                    }

                    // 2. Check for a transceiver with no sender track (created by remote offer)
                    const transceiver = pc.getTransceivers().find(
                        (t) => !t.sender.track && t.receiver.track?.kind === track.kind
                    );

                    if (transceiver) {
                        transceiver.sender.replaceTrack(track);
                        if (transceiver.direction === 'recvonly') {
                            transceiver.direction = 'sendrecv';
                        }
                        console.log(`[WebRTC] Reused transceiver for ${track.kind} for ${remotePeerId}`);
                        return;
                    }

                    // 3. No match — add brand new track+stream (triggers onnegotiationneeded)
                    pc.addTrack(track, stream);
                    console.log(`[WebRTC] Added new ${track.kind} track for ${remotePeerId}`);
                });
            }
            console.log('[WebRTC] Added tracks to all peers');
        },
        [peerId]
    );

    /* ── Remove media tracks from all peers (for ending call) ── */
    const removeTracksFromAllPeers = useCallback(() => {
        connections.current.forEach((entry) => {
            const pc = entry.pc;
            pc.getSenders().forEach((sender) => {
                if (sender.track) {
                    sender.replaceTrack(null);
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
