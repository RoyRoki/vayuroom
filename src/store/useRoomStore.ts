import { create } from 'zustand';
import type { Message, Peer, ConnectionStatus, CallStatus } from '../types';

interface RoomStore {
    /* ── State ── */
    roomHash: string;
    connectionStatus: ConnectionStatus;
    callStatus: CallStatus;
    messages: Message[];
    remotePeers: Record<string, Peer>;
    peerCount: number;

    /* ── Actions ── */
    setRoomHash: (hash: string) => void;
    setConnectionStatus: (status: ConnectionStatus) => void;
    setCallStatus: (status: CallStatus) => void;

    addMessage: (msg: Message) => void;
    clearMessages: () => void;

    addRemotePeer: (id: string, displayName: string) => void;
    removeRemotePeer: (id: string) => void;
    updatePeerState: (id: string, state: RTCPeerConnectionState) => void;
    updatePeerStream: (id: string, stream: MediaStream) => void;

    reset: () => void;
}

const initialState = {
    roomHash: '',
    connectionStatus: 'idle' as ConnectionStatus,
    callStatus: 'none' as CallStatus,
    messages: [] as Message[],
    remotePeers: {} as Record<string, Peer>,
    peerCount: 0,
};

export const useRoomStore = create<RoomStore>((set) => ({
    ...initialState,

    setRoomHash: (hash) => set({ roomHash: hash }),
    setConnectionStatus: (status) => set({ connectionStatus: status }),
    setCallStatus: (status) => set({ callStatus: status }),

    addMessage: (msg) =>
        set((s) => ({ messages: [...s.messages, msg] })),

    clearMessages: () => set({ messages: [] }),

    addRemotePeer: (id, displayName) =>
        set((s) => {
            const peer: Peer = {
                id,
                displayName,
                isAudioEnabled: true,
                isVideoEnabled: false,
                connectionState: 'new',
            };
            const remotePeers = { ...s.remotePeers, [id]: peer };
            return { remotePeers, peerCount: Object.keys(remotePeers).length + 1 };
        }),

    removeRemotePeer: (id) =>
        set((s) => {
            const { [id]: _, ...rest } = s.remotePeers;
            return { remotePeers: rest, peerCount: Object.keys(rest).length + 1 };
        }),

    updatePeerState: (id, state) =>
        set((s) => {
            const peer = s.remotePeers[id];
            if (!peer) return s;
            return {
                remotePeers: {
                    ...s.remotePeers,
                    [id]: { ...peer, connectionState: state },
                },
            };
        }),

    updatePeerStream: (id, stream) =>
        set((s) => {
            const peer = s.remotePeers[id];
            if (!peer) return s;
            return {
                remotePeers: {
                    ...s.remotePeers,
                    [id]: { ...peer, stream, isVideoEnabled: stream.getVideoTracks().length > 0 },
                },
            };
        }),

    reset: () => set(initialState),
}));
