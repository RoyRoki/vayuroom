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
export type MessageType = 'user' | 'system' | 'call';

export interface CallEventData {
    callerName: string;
    callStatus: 'completed' | 'missed' | 'declined';
    callStartTime?: number;
    callEndTime?: number;
    callDuration?: number; // seconds
}

export interface Message {
    id: string;
    type?: MessageType;
    senderId?: string;
    senderName?: string;
    text: string;
    timestamp: number;
    encrypted?: string;
    iv?: string;
    callEvent?: CallEventData;
}

/* ── Room ── */
export type ConnectionStatus = 'idle' | 'joining' | 'connected' | 'reconnecting' | 'failed';
export type ConnectionQuality = 'good' | 'fair' | 'poor' | 'unknown';
export type CallStatus = 'none' | 'active' | 'ended';

/* ── Incoming Call ── */
export interface IncomingCallInfo {
    callerId: string;
    callerName: string;
    callType: 'audio' | 'video';
    timestamp: number;
}

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
    encrypted?: string;
    iv?: string;
}

/* ── Call Signaling ── */
export type CallSignalType = 'call-start' | 'call-answer' | 'call-reject' | 'call-end';

export interface CallSignal {
    id: string;
    type: CallSignalType;
    senderId: string;
    senderName: string;
    callType: 'audio' | 'video';
    timestamp: number;
    payload?: {
        duration?: number;
        startTime?: number;
        endTime?: number;
    };
}

export interface CallState {
    status: 'ringing' | 'active';
    callerId: string;
    callerName: string;
    callType: 'audio' | 'video';
    startTime: number;
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
    isScreenSharing: boolean;
    toggleAudio: () => void;
    toggleVideo: () => void;
    startMedia: (video?: boolean) => Promise<MediaStream>;
    stopMedia: () => void;
    startScreenShare: () => Promise<MediaStream | null>;
    stopScreenShare: () => Promise<MediaStream | null>;
    localStream: MediaStream | null;
    isScreenShareSupported: boolean;
}

/* ── Constants ── */
export const MAX_PEERS = 3;
export const HEARTBEAT_INTERVAL = 15_000;   // 15s
export const PRESENCE_STALE_MS = 60_000;         // 60s (4 missed heartbeats = stale)
export const SIGNAL_TTL_MS = 5 * 60 * 1000;    // 5 mins
export const ICE_RESTART_MAX = 3;
export const DATA_CHANNEL_LABEL = 'vayuroom-chat';
