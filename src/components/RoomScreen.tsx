import { RoomHeader } from './RoomHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { AudioCall } from './AudioCall';
import { useRoomStore } from '../store/useRoomStore';
import './RoomScreen.css';

interface Props {
    localPeerId: string;
    localStream: MediaStream | null;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isCallActive: boolean;
    onSendMessage: (text: string) => void;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onToggleCall: (video?: boolean) => void;
    onLeave: () => void;
    connectionQuality: import('../types').ConnectionQuality;
}

export function RoomScreen({
    localPeerId,
    isAudioEnabled,
    isCallActive,
    onSendMessage,
    onToggleAudio,
    onToggleCall,
    onLeave,
    connectionQuality,
}: Props) {
    const messages = useRoomStore((s) => s.messages);
    const remotePeers = useRoomStore((s) => s.remotePeers);
    const connectionStatus = useRoomStore((s) => s.connectionStatus);

    // Derive peer count from remote peers + 1 (local user)
    const peerCount = remotePeers ? Object.keys(remotePeers).length + 1 : 1;

    return (
        <div className="room-screen">
            <RoomHeader
                peerCount={peerCount}
                connectionStatus={connectionStatus}
                onLeave={onLeave}
                onToggleCall={onToggleCall}
                isCallActive={isCallActive}
                connectionQuality={connectionQuality}
            />

            <MessageList messages={messages} localPeerId={localPeerId} />

            <ChatInput
                onSend={onSendMessage}
                disabled={connectionStatus !== 'connected' && connectionStatus !== 'joining'}
            />

            {/* Instagram-style audio call overlay */}
            {isCallActive && (
                <AudioCall
                    peerCount={peerCount}
                    isAudioEnabled={isAudioEnabled}
                    remotePeers={remotePeers}
                    onToggleAudio={onToggleAudio}
                    onEndCall={onToggleCall}
                />
            )}
        </div>
    );
}
