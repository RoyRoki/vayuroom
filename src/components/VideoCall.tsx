import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Lock, User, SwitchCamera, Phone, MonitorUp, MonitorOff } from 'lucide-react';
import type { Peer } from '../types';
import './VideoCall.css';

interface Props {
    localStream: MediaStream | null;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    remotePeers: Record<string, Peer>;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onSwitchCamera: () => void;
    onEndCall: () => void;
    isCallAnswered: boolean;
    startTime?: number;
    isScreenSharing: boolean;
    isScreenShareSupported: boolean;
    onToggleScreenShare: () => void;
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
    onSwitchCamera,
    onEndCall,
    isCallAnswered,
    startTime,
    isScreenSharing,
    isScreenShareSupported,
    onToggleScreenShare,
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

                {/* CASE 1: Calling... (Not answered yet) — Animated like AudioCall */}
                {!isCallAnswered && (
                    <div className="video-call-waiting">
                        <div className="vcall-avatar-wrap">
                            <div className="vcall-avatar is-calling">
                                <div className="vcall-avatar-inner">
                                    <Phone size={48} className="vcall-avatar-icon animate-pulse-slow" />
                                </div>
                            </div>
                            {/* Pulse rings */}
                            <div className="vcall-ring vcall-ring--1" />
                            <div className="vcall-ring vcall-ring--2" />
                            <div className="vcall-ring vcall-ring--3" />
                        </div>

                        <div className="vcall-info">
                            <span className="vcall-name">
                                {isGroupCall ? 'Group Call' : remoteName}
                            </span>
                            <div className="vcall-status-wrap">
                                <Phone size={16} className="animate-pulse" />
                                <span className="vcall-status">Calling</span>
                                <div className="vcall-status-dots">
                                    <span>.</span><span>.</span><span>.</span>
                                </div>
                            </div>
                        </div>
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

                {/* Switch Camera Button (only show if video enabled?) or always show */}
                {isVideoEnabled && !isScreenSharing && (
                    <button
                        className="video-call-btn"
                        onClick={onSwitchCamera}
                        title="Switch Camera"
                    >
                        <SwitchCamera size={24} />
                    </button>
                )}

                {isScreenShareSupported && (
                    <button
                        className={`video-call-btn ${isScreenSharing ? 'is-active' : ''}`}
                        onClick={onToggleScreenShare}
                        title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                    >
                        {isScreenSharing ? <MonitorOff size={24} /> : <MonitorUp size={24} />}
                    </button>
                )}

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
    const [hasVideo, setHasVideo] = useState(false);

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
            // Check if there's actually a video track
            const checkVideo = () => {
                const tracks = peer.stream?.getVideoTracks() || [];
                const enabled = tracks.some(t => t.enabled && t.readyState === 'live');
                setHasVideo(peer.isVideoEnabled && enabled);
            };

            checkVideo();
            // Listen for track changes (mute/unmute)
            peer.stream.getVideoTracks().forEach(track => {
                track.onmute = checkVideo;
                track.onunmute = checkVideo;
                track.onended = checkVideo;
            });
            return () => {
                peer.stream?.getVideoTracks().forEach(track => {
                    track.onmute = null;
                    track.onunmute = null;
                    track.onended = null;
                });
            };
        } else {
            setHasVideo(false);
        }
    }, [peer.stream, peer.isVideoEnabled]);

    return (
        <div className={`${className || "video-el"} video-el-container`}>
            {/* Always render video for audio playback */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`video-el ${hasVideo ? 'is-visible' : 'is-hidden'}`}
            />

            {/* Fallback Avatar */}
            {!hasVideo && (
                <div className="video-fallback-avatar">
                    <div className="video-call-avatar-inner">
                        <User size={48} className="text-white" />
                    </div>
                    <span className="video-fallback-name">{peer.displayName}</span>
                </div>
            )}
        </div>
    );
}
