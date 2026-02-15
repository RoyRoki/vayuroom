import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff } from 'lucide-react';
import './CallControls.css';

interface Props {
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isCallActive: boolean;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onToggleCall: () => void;
}

export function CallControls({
    isAudioEnabled,
    isVideoEnabled,
    isCallActive,
    onToggleAudio,
    onToggleVideo,
    onToggleCall,
}: Props) {
    return (
        <div className="call-controls">
            <button
                className={`btn-icon call-btn ${!isAudioEnabled ? 'active' : ''}`}
                onClick={onToggleAudio}
                title={isAudioEnabled ? 'Mute' : 'Unmute'}
            >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <button
                className={`btn-icon call-btn ${!isVideoEnabled ? 'active' : ''}`}
                onClick={onToggleVideo}
                title={isVideoEnabled ? 'Camera off' : 'Camera on'}
            >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </button>

            <button
                className={`btn-icon call-btn call-toggle ${isCallActive ? 'call-end' : 'call-start'}`}
                onClick={onToggleCall}
                title={isCallActive ? 'End call' : 'Start call'}
            >
                {isCallActive ? <PhoneOff size={20} /> : <Phone size={20} />}
            </button>
        </div>
    );
}
