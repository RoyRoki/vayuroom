import { Logo } from './Logo';
import { StatusIndicator } from './StatusIndicator';
import { LogOut, Users } from 'lucide-react';
import type { ConnectionStatus } from '../types';
import { MAX_PEERS } from '../types';
import './RoomHeader.css';

interface Props {
    peerCount: number;
    connectionStatus: ConnectionStatus;
    onLeave: () => void;
}

function getStatusType(status: ConnectionStatus): 'online' | 'connecting' | 'offline' {
    switch (status) {
        case 'connected': return 'online';
        case 'joining':
        case 'reconnecting': return 'connecting';
        default: return 'offline';
    }
}

function getStatusLabel(status: ConnectionStatus): string {
    switch (status) {
        case 'connected': return 'Connected';
        case 'joining': return 'Joining...';
        case 'reconnecting': return 'Reconnecting...';
        case 'failed': return 'Connection failed';
        default: return 'Idle';
    }
}

export function RoomHeader({ peerCount, connectionStatus, onLeave }: Props) {
    return (
        <header className="room-header">
            <Logo size="sm" />

            <div className="room-header-info">
                <div className="room-header-peers">
                    <Users size={14} />
                    <span>{peerCount}/{MAX_PEERS}</span>
                </div>
                <StatusIndicator
                    status={getStatusType(connectionStatus)}
                    label={getStatusLabel(connectionStatus)}
                />
            </div>

            <button className="btn btn-ghost room-leave-btn" onClick={onLeave}>
                <LogOut size={18} />
                <span className="room-leave-text">Leave</span>
            </button>
        </header>
    );
}
