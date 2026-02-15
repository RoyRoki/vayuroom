/* ── Peer ── */
export interface Peer {
    id: string;
    displayName: string;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    stream?: MediaStream;
    connectionState: RTCPeerConnectionState;
}

/* ── Message ── */
export type MessageType = 'user' | 'system';

export interface Message {
    id: string;
    type?: MessageType;
    senderId?: string;
    senderName?: string;
    text: string;
    timestamp: number;
    encrypted?: string;
    iv?: string;
}

/* ── Room ── */
export type ConnectionStatus = 'idle' | 'joining' | 'connected' | 'reconnecting' | 'failed';
export type ConnectionQuality = 'good' | 'fair' | 'poor' | 'unknown';
export type CallStatus = 'none' | 'active' | 'ended';

export interface RoomState {
    /* identity */
    roomHash: string;
    passphrase: string;
    aesKey: CryptoKey | null;
    localPeer: Peer;

    /* peers */
    remotePeers: Record<string, Peer>;
    peerCount: number;

    /* chat */
    messages: Message[];

    /* status */
    connectionStatus: ConnectionStatus;
    callStatus: CallStatus;
}

/* ── Signaling ── */
export interface Signal {
    id: string;
    type: 'offer' | 'answer' | 'candidate' | 'leave';
    senderId: string;
    targetId: string;
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
    timestamp: number;
    politeness: number;
}

export interface PresenceEntry {
    displayName: string;
    timestamp: number;
    order: number;
}

/* ── Derived key result ── */
export interface DerivedKeyResult {
    aesKey: CryptoKey;
    roomHash: string;
}

/* ── Media controls ── */
export interface MediaControls {
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    toggleAudio: () => void;
    toggleVideo: () => void;
    startMedia: (video?: boolean) => Promise<MediaStream>;
    stopMedia: () => void;
    localStream: MediaStream | null;
}

/* ── Constants ── */
export const MAX_PEERS = 3;
export const HEARTBEAT_INTERVAL = 15_000;   // 15s
export const PRESENCE_STALE_MS = 60 * 60 * 1000; // 1 hour (handling clock skew)
export const SIGNAL_TTL_MS = 5 * 60 * 1000;    // 5 mins
export const ICE_RESTART_MAX = 3;
export const DATA_CHANNEL_LABEL = 'vayuroom-chat';
