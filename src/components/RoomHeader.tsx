import { toast } from 'react-hot-toast';
import { Logo } from './Logo';
import { StatusIndicator } from './StatusIndicator';
import { LogOut, User, Users, UserPlus, UserX, Phone, Video } from 'lucide-react';
import type { ConnectionStatus, ConnectionQuality } from '../types';
import { MAX_PEERS } from '../types';
import { useRoomStore } from '../store/useRoomStore';
import './RoomHeader.css';

interface Props {
    peerCount: number;
    connectionStatus: ConnectionStatus;
    connectionQuality: ConnectionQuality;
    onLeave: () => void;
    onToggleCall: (video?: boolean) => void;
    isCallActive: boolean;
    roomCallStatus: 'ringing' | 'active' | 'idle';
}

function getStatusType(status: ConnectionStatus, quality: ConnectionQuality): 'online' | 'connecting' | 'offline' | 'fair' | 'poor' {
    switch (status) {
        case 'connected':
            if (quality === 'good' || quality === 'unknown') return 'online';
            return quality; // 'fair' or 'poor'
        case 'joining':
        case 'reconnecting': return 'connecting';
        default: return 'offline';
    }
}

export function RoomHeader({ peerCount, connectionStatus, connectionQuality, onLeave, onToggleCall, isCallActive, roomCallStatus }: Props) {
    const isSoundEnabled = useRoomStore((s) => s.isSoundEnabled);
    const toggleSound = useRoomStore((s) => s.toggleSound);

    const handleSecretToggle = () => {
        toggleSound();
        const newState = !isSoundEnabled;
        toast(newState ? 'Sound On 🔊' : 'Sound Off 🔇', {
            id: 'sound-toggle',
            style: {
                background: '#333',
                color: '#fff',
            }
        });
    };

    return (
        <header className="room-header">
            <div className="room-header-logo" onDoubleClick={handleSecretToggle} style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '12px' }} title="Double click to toggle sound">
                <Logo
                    size="sm"
                    iconOverlay={
                        <StatusIndicator status={getStatusType(connectionStatus, connectionQuality)} />
                    }
                />
                <div className="room-header-peers" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    {peerCount === 1 ? (
                        <User size={14} />
                    ) : peerCount === 2 ? (
                        <Users size={14} />
                    ) : peerCount === 3 ? (
                        <UserPlus size={14} />
                    ) : (
                        <UserX size={14} />
                    )}
                </div>
            </div>

            <div className="room-header-actions">
                {!isCallActive && roomCallStatus === 'idle' && (
                    <>
                        <button
                            className="btn btn-ghost room-call-btn"
                            onClick={() => onToggleCall(false)}
                            title="Start audio call"
                        >
                            <Phone size={18} />
                        </button>
                        <button
                            className="btn btn-ghost room-call-btn"
                            onClick={() => onToggleCall(true)}
                            title="Start video call"
                        >
                            <Video size={18} />
                        </button>
                    </>
                )}

                {!isCallActive && roomCallStatus === 'active' && (
                    <button
                        className="btn btn-primary room-join-btn"
                        onClick={() => onToggleCall(false)} // Default to audio join, or maybe video?
                        title="Join existing call"
                        style={{ backgroundColor: '#22c55e', color: 'white', gap: '8px' }}
                    >
                        <Phone size={18} />
                        <span>Join Call</span>
                    </button>
                )}

                <button className="btn btn-ghost room-leave-btn" onClick={onLeave} title="Leave room">
                    <LogOut size={18} />
                </button>
            </div>
        </header>
    );
}

