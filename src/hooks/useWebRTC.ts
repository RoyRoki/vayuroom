import { useRef, useCallback } from 'react';
import { fetchIceServers, fallbackIceServers } from '../lib/iceServers';
import { encrypt, decrypt } from '../lib/crypto';
import { generateId, now } from '../lib/utils';
import { useRoomStore } from '../store/useRoomStore';
import {
    MAX_PEERS,
    ICE_RESTART_MAX,
    DATA_CHANNEL_LABEL,
} from '../types';
import type { Signal, Message, PresenceEntry } from '../types';

interface PeerConnection {
    pc: RTCPeerConnection;
    dc: RTCDataChannel | null;
    restartCount: number;
    makingOffer: boolean;
}

interface UseWebRTCProps {
    peerId: string;
    displayName: string;
    aesKey: CryptoKey;
    localStream: MediaStream | null;
    sendSignal: (signal: Omit<Signal, 'id' | 'timestamp' | 'politeness'>) => Promise<void>;
    joinOrder: number;
}

export function useWebRTC({
    peerId,
    displayName,
    aesKey,
    localStream,
    sendSignal,
    joinOrder,
}: UseWebRTCProps) {
    const connections = useRef<Map<string, PeerConnection>>(new Map());
    const iceServersRef = useRef<RTCIceServer[]>(fallbackIceServers);

    const addMessage = useRoomStore((s) => s.addMessage);
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

            // Data channel (for chat)
            pc.ondatachannel = (e) => {
                const dc = e.channel;
                entry.dc = dc;
                setupDataChannel(dc, remotePeerId);
            };

            connections.current.set(remotePeerId, entry);
            addRemotePeer(remotePeerId, remoteDisplayName);
            return entry;
        },
        [localStream, peerId, sendSignal, addRemotePeer, updatePeerState, updatePeerStream]
    );

    /* ── Data Channel setup ── */
    const setupDataChannel = useCallback(
        (dc: RTCDataChannel, remotePeerId: string) => {
            dc.onmessage = async (e) => {
                try {
                    const { encrypted, iv, senderName, timestamp, id } = JSON.parse(e.data);
                    const text = await decrypt(aesKey, encrypted, iv);
                    const msg: Message = {
                        id,
                        senderId: remotePeerId,
                        senderName,
                        text,
                        timestamp,
                        encrypted,
                        iv,
                    };
                    addMessage(msg);
                } catch (err) {
                    console.error('[DataChannel] Failed to decrypt message:', err);
                }
            };
        },
        [aesKey, addMessage]
    );

    /* ── Send chat message ── */
    const sendMessage = useCallback(
        async (text: string) => {
            const { encrypted, iv } = await encrypt(aesKey, text);
            const msg: Message = {
                id: generateId(),
                senderId: peerId,
                senderName: displayName,
                text,
                timestamp: now(),
                encrypted,
                iv,
            };

            // Send to all connected peers via data channel
            const payload = JSON.stringify({
                id: msg.id,
                encrypted: msg.encrypted,
                iv: msg.iv,
                senderName: msg.senderName,
                timestamp: msg.timestamp,
            });

            connections.current.forEach(({ dc }) => {
                if (dc && dc.readyState === 'open') {
                    dc.send(payload);
                }
            });

            // Add to local messages
            addMessage(msg);
        },
        [aesKey, peerId, displayName, addMessage]
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
                    entry = createConnection(senderId, `User-${senderId.slice(-4).toUpperCase()}`)!;
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

            // Create data channel (only the initiator creates it)
            const dc = entry.pc.createDataChannel(DATA_CHANNEL_LABEL);
            entry.dc = dc;
            setupDataChannel(dc, remotePeerId);

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
        [peerId, sendSignal, createConnection, setupDataChannel]
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

    return {
        initIceServers,
        handleSignal,
        handlePeerJoin,
        sendMessage,
        closeAll,
        connectToPeer,
        closeConnection,
    };
}
