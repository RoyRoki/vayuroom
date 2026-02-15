import { RoomHeader } from './RoomHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { CallControls } from './CallControls';
import { VideoCall } from './VideoCall';
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
    onToggleCall: () => void;
    onLeave: () => void;
}

export function RoomScreen({
    localPeerId,
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    isCallActive,
    onSendMessage,
    onToggleAudio,
    onToggleVideo,
    onToggleCall,
    onLeave,
}: Props) {
    const messages = useRoomStore((s) => s.messages);
    const remotePeers = useRoomStore((s) => s.remotePeers);
    const peerCount = useRoomStore((s) => s.peerCount);
    const connectionStatus = useRoomStore((s) => s.connectionStatus);

    return (
        <div className="room-screen">
            <RoomHeader
                peerCount={peerCount}
                connectionStatus={connectionStatus}
                onLeave={onLeave}
            />

            {isCallActive && (
                <VideoCall
                    localStream={localStream}
                    remotePeers={remotePeers}
                    isVideoEnabled={isVideoEnabled}
                />
            )}

            <MessageList messages={messages} localPeerId={localPeerId} />

            <ChatInput
                onSend={onSendMessage}
                disabled={connectionStatus !== 'connected' && connectionStatus !== 'joining'}
            />

            <CallControls
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
                isCallActive={isCallActive}
                onToggleAudio={onToggleAudio}
                onToggleVideo={onToggleVideo}
                onToggleCall={onToggleCall}
            />
        </div>
    );
}
