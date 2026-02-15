import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Lock, User } from 'lucide-react';
import type { Peer } from '../types';
import './VideoCall.css';

interface Props {
    localStream: MediaStream | null;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    remotePeers: Record<string, Peer>;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onEndCall: () => void;
    isCallAnswered: boolean;
    startTime?: number;
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function VideoCall({
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    remotePeers,
    onToggleAudio,
    onToggleVideo,
    onEndCall,
    isCallAnswered,
    startTime,
}: Props) {
    const [elapsed, setElapsed] = useState(0);
    const startTimeRef = useRef(startTime || Date.now());

    // Call timer
    useEffect(() => {
        if (!isCallAnswered) {
            setElapsed(0);
            return;
        }

        startTimeRef.current = startTime || Date.now();
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [isCallAnswered, startTime]);

    const remoteEntries = Object.entries(remotePeers);
    const isGroupCall = remoteEntries.length > 1;
    const remoteName = remoteEntries[0]?.[1]?.displayName || 'Video Call';

    // We render differently based on:
    // 1. Not answered (Calling...)
    // 2. Answered 1:1 (Full screen remote, PiP local)
    // 3. Answered Group (Grid)

    return (
        <div className="video-call-overlay">
            {/* Top Bar */}
            <div className="video-call-top">
                <span className="video-call-label">Vroom</span>
                <span className="video-call-encrypt">
                    <Lock size={10} />
                    End-to-end encrypted
                </span>
                {isCallAnswered && (
                    <span className="video-call-timer">{formatTime(elapsed)}</span>
                )}
            </div>

            {/* Main Content */}
            <div className="video-call-content" style={{ flex: 1, position: 'relative' }}>

                {/* CASE 1: Calling... (Not answered yet) */}
                {!isCallAnswered && (
                    <div className="video-call-waiting">
                        <div className="video-call-waiting-avatar">
                            <User size={48} />
                        </div>
                        <span className="video-call-waiting-name">
                            {isGroupCall ? 'Group Call' : remoteName}
                        </span>
                        <span className="video-call-waiting-status">Calling...</span>

                        {/* We show local video in background or faint if desired, 
                            but standard behavior is often just the calling screen. 
                            However, user might want to see themselves. Let's put local video as full background for now?
                            Or just keep it simple with the darkened background.
                        */}
                    </div>
                )}

                {/* CASE 2: Connected 1:1 */}
                {isCallAnswered && !isGroupCall && (
                    <div className="video-grid-1">
                        {/* Remote Peer (Full Screen) */}
                        {remoteEntries.map(([id, peer]) => (
                            <RemoteVideo key={id} peer={peer} className="video-el" />
                        ))}
                    </div>
                )}

                {/* CASE 3: Connected Group */}
                {isCallAnswered && isGroupCall && (
                    <div className="video-grid">
                        {/* Local user in grid for group calls */}
                        <div className="video-cell">
                            <LocalVideo stream={localStream} isEnabled={isVideoEnabled} />
                            <span className="video-cell-name">You</span>
                        </div>
                        {remoteEntries.map(([id, peer]) => (
                            <div key={id} className="video-cell">
                                <RemoteVideo peer={peer} className="video-el" />
                                <span className="video-cell-name">{peer.displayName}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* PiP for 1:1 calls (Local Video) */}
                {(isCallAnswered || !isCallAnswered) && !isGroupCall && (
                    <div className={`video-pip ${!isCallAnswered ? 'video-pip-calling' : ''}`}>
                        <LocalVideo stream={localStream} isEnabled={isVideoEnabled} />
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            <div className="video-call-controls">
                <button
                    className={`video-call-btn ${!isVideoEnabled ? 'is-active' : ''}`}
                    onClick={onToggleVideo}
                >
                    {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
                </button>

                <button
                    className={`video-call-btn ${!isAudioEnabled ? 'is-active' : ''}`}
                    onClick={onToggleAudio}
                >
                    {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                </button>

                <button
                    className="video-call-btn video-call-btn--end"
                    onClick={onEndCall}
                >
                    <PhoneOff size={32} />
                </button>
            </div>
        </div>
    );
}

function LocalVideo({ stream, isEnabled }: { stream: MediaStream | null, isEnabled: boolean }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    if (!isEnabled) {
        return (
            <div className="video-off-placeholder">
                <User size={24} />
            </div>
        );
    }

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="video-el"
        />
    );
}

function RemoteVideo({ peer, className }: { peer: Peer, className?: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer.stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            className={className || "video-el"}
        />
    );
}
