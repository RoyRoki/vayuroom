import { RoomHeader } from './RoomHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { AudioCall } from './AudioCall';
import { VideoCall } from './VideoCall';
import { IncomingCall } from './IncomingCall';
import { useRoomStore } from '../store/useRoomStore';
import './RoomScreen.css';

interface Props {
    localPeerId: string;
    localStream: MediaStream | null;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isCallActive: boolean;
    isCallAnswered: boolean;
    onSendMessage: (text: string) => void;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onToggleCall: (video?: boolean) => void;
    onAcceptCall: () => void;
    onDeclineCall: () => void;
    onLeave: () => void;
    connectionQuality: import('../types').ConnectionQuality;
    callStartTime?: number;
    activeCallType: 'audio' | 'video' | null;
}

export function RoomScreen({
    localPeerId,
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    isCallActive,
    isCallAnswered,
    onSendMessage,
    onToggleAudio,
    onToggleVideo,
    onToggleCall,
    onAcceptCall,
    onDeclineCall,
    onLeave,
    connectionQuality,
    callStartTime,
    activeCallType,
}: Props) {
    const messages = useRoomStore((s) => s.messages);
    const remotePeers = useRoomStore((s) => s.remotePeers);
    const connectionStatus = useRoomStore((s) => s.connectionStatus);
    const incomingCall = useRoomStore((s) => s.incomingCall);

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

            {/* Call Overlay */}
            {isCallActive && activeCallType === 'audio' && (
                <AudioCall
                    peerCount={peerCount}
                    isAudioEnabled={isAudioEnabled}
                    remotePeers={remotePeers}
                    onToggleAudio={onToggleAudio}
                    onEndCall={() => onToggleCall(false)}
                    isCallAnswered={isCallAnswered}
                    startTime={callStartTime}
                />
            )}

            {isCallActive && activeCallType === 'video' && (
                <VideoCall
                    localStream={localStream}
                    isAudioEnabled={isAudioEnabled}
                    isVideoEnabled={isVideoEnabled}
                    remotePeers={remotePeers}
                    onToggleAudio={onToggleAudio}
                    onToggleVideo={onToggleVideo}
                    onEndCall={() => onToggleCall(false)}
                    isCallAnswered={isCallAnswered}
                    startTime={callStartTime}
                />
            )}

            {/* Incoming call ringing overlay */}
            {incomingCall && !isCallActive && (
                <IncomingCall
                    callInfo={incomingCall}
                    onAccept={onAcceptCall}
                    onDecline={onDeclineCall}
                />
            )}
        </div>
    );
}

