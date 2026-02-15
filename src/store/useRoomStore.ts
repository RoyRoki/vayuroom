import { create } from 'zustand';
import type { Message, Peer, ConnectionStatus, CallStatus, IncomingCallInfo, CallEventData } from '../types';

interface RoomStore {
    /* ── State ── */
    roomHash: string;
    connectionStatus: ConnectionStatus;
    callStatus: CallStatus;
    messages: Message[];
    remotePeers: Record<string, Peer>;
    peerCount: number;

    /* ── Call State ── */
    incomingCall: IncomingCallInfo | null;
    callStartTime: number | null;
    callEndTime: number | null;

    /* ── Actions ── */
    setRoomHash: (hash: string) => void;
    setConnectionStatus: (status: ConnectionStatus) => void;
    setCallStatus: (status: CallStatus) => void;

    addMessage: (msg: Message) => void;
    addSystemMessage: (text: string) => void;
    addCallEventMessage: (callEvent: CallEventData) => void;
    clearMessages: () => void;

    setIncomingCall: (info: IncomingCallInfo | null) => void;
    setCallStartTime: (t: number | null) => void;
    setCallEndTime: (t: number | null) => void;

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
    incomingCall: null as IncomingCallInfo | null,
    callStartTime: null as number | null,
    callEndTime: null as number | null,
};

export const useRoomStore = create<RoomStore>((set) => ({
    ...initialState,

    setRoomHash: (hash) => set({ roomHash: hash }),
    setConnectionStatus: (status) => set({ connectionStatus: status }),
    setCallStatus: (status) => set({ callStatus: status }),

    addMessage: (msg) =>
        set((s) => {
            if (s.messages.some(m => m.id === msg.id)) {
                return s;
            }
            return { messages: [...s.messages, msg] };
        }),

    addSystemMessage: (text) =>
        set((s) => ({
            messages: [
                ...s.messages,
                {
                    id: crypto.randomUUID(),
                    type: 'system' as const,
                    text,
                    timestamp: Date.now(),
                },
            ],
        })),

    addCallEventMessage: (callEvent) =>
        set((s) => ({
            messages: [
                ...s.messages,
                {
                    id: crypto.randomUUID(),
                    type: 'call' as const,
                    text: '',
                    timestamp: Date.now(),
                    callEvent,
                },
            ],
        })),

    clearMessages: () => set({ messages: [] }),

    setIncomingCall: (info) => set({ incomingCall: info }),
    setCallStartTime: (t) => set({ callStartTime: t }),
    setCallEndTime: (t) => set({ callEndTime: t }),

    addRemotePeer: (id, displayName) =>
        set((s) => {
            const existing = s.remotePeers[id];
            const peer: Peer = existing ? {
                ...existing,
                displayName,
            } : {
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
