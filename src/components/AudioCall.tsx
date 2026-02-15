import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, PhoneOff, Lock, User } from 'lucide-react';
import type { Peer } from '../types';
import './AudioCall.css';

interface Props {
    peerCount: number;
    isAudioEnabled: boolean;
    remotePeers: Record<string, Peer>;
    onToggleAudio: () => void;
    onEndCall: () => void;
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Hidden audio element that plays a remote peer's stream */
function RemoteAudio({ peer, resumeTrigger }: { peer: Peer, resumeTrigger: number }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current && peer.stream) {
            audioRef.current.srcObject = peer.stream;
            audioRef.current.play().catch(() => {
                console.warn('[AudioCall] Autoplay blocked for', peer.id);
            });
        }
    }, [peer.stream, peer.id, resumeTrigger]);

    if (!peer.stream) return null;

    return (
        <audio
            ref={audioRef}
            autoPlay
            playsInline
        />
    );
}

export function AudioCall({
    peerCount,
    isAudioEnabled,
    remotePeers,
    onToggleAudio,
    onEndCall,
}: Props) {
    const [elapsed, setElapsed] = useState(0);
    const [speakerOn, setSpeakerOn] = useState(false);
    const [interactionRequired, setInteractionRequired] = useState(false);
    const [resumeTrigger, setResumeTrigger] = useState(0);
    const startTimeRef = useRef(Date.now());

    // Call timer
    useEffect(() => {
        startTimeRef.current = Date.now();
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Check for autoplay block
    useEffect(() => {
        const checkAutoplay = async () => {
            try {
                const testAudio = new Audio();
                await testAudio.play();
            } catch (e) {
                console.warn('[AudioCall] Interaction required for audio');
                setInteractionRequired(true);
            }
        };
        checkAutoplay();
    }, []);

    const handleResume = () => {
        setInteractionRequired(false);
        setResumeTrigger(v => v + 1);
    };

    const isConnected = peerCount > 1;
    const remoteEntries = Object.entries(remotePeers);
    const remoteName = remoteEntries[0]?.[1]?.displayName || 'Audio Call';

    return (
        <div className="audio-call-overlay">
            {/* Hidden audio elements for each remote peer */}
            {remoteEntries.map(([id, peer]) => (
                <RemoteAudio key={id} peer={peer} resumeTrigger={resumeTrigger} />
            ))}

            {/* Interaction Overlay for Autoplay */}
            {interactionRequired && (
                <div className="audio-call-interaction" onClick={handleResume}>
                    <div className="audio-call-interaction-content">
                        <Volume2 size={48} className="animate-pulse" />
                        <h2>Click to Join Audio</h2>
                        <p>Browser requires interaction to play sound</p>
                    </div>
                </div>
            )}

            {/* Top */}
            <div className="audio-call-top">
                <span className="audio-call-label">Vroom</span>
                <span className="audio-call-encrypt">
                    <Lock size={10} />
                    End-to-end encrypted
                </span>
            </div>

            {/* Center — Avatar + Info */}
            <div className="audio-call-center">
                <div className="audio-call-avatar-wrap">
                    <div className={`audio-call-avatar ${isConnected ? 'is-connected' : 'is-calling'}`}>
                        <div className="audio-call-avatar-inner">
                            <User size={48} className="audio-call-avatar-icon" />
                        </div>
                    </div>
                    {/* Pulse rings — only animate when connected */}
                    {isConnected && (
                        <>
                            <div className="audio-call-ring audio-call-ring--1" />
                            <div className="audio-call-ring audio-call-ring--2" />
                            <div className="audio-call-ring audio-call-ring--3" />
                        </>
                    )}
                </div>

                <div className="audio-call-info">
                    <span className="audio-call-name">
                        {peerCount > 2 ? 'Group Call' : remoteName}
                    </span>

                    {!isConnected ? (
                        <span className="audio-call-status animate-pulse">Calling...</span>
                    ) : (
                        <div className="audio-call-timer-wrap">
                            <span className="audio-call-timer">{formatTime(elapsed)}</span>
                            {peerCount > 2 && (
                                <span className="audio-call-count">· {peerCount} people</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="audio-call-controls">
                <button
                    className={`audio-call-btn audio-call-btn--mute ${!isAudioEnabled ? 'is-muted' : ''}`}
                    onClick={onToggleAudio}
                >
                    {isAudioEnabled ? <Mic size={22} /> : <MicOff size={22} />}
                    <span className="audio-call-btn-label">
                        {isAudioEnabled ? 'Mute' : 'Unmute'}
                    </span>
                </button>

                <button
                    className={`audio-call-btn audio-call-btn--end`}
                    onClick={onEndCall}
                >
                    <PhoneOff size={24} />
                    <span className="audio-call-btn-label">End</span>
                </button>

                <button
                    className={`audio-call-btn audio-call-btn--speaker ${speakerOn ? 'is-active' : ''}`}
                    onClick={() => setSpeakerOn(!speakerOn)}
                >
                    <Volume2 size={22} />
                    <span className="audio-call-btn-label">Speaker</span>
                </button>
            </div>
        </div>
    );
}

