import { useRef, useEffect } from 'react';
import type { Peer } from '../types';
import './VideoCall.css';

interface Props {
    localStream: MediaStream | null;
    remotePeers: Record<string, Peer>;
    isVideoEnabled: boolean;
}

export function VideoCall({ localStream, remotePeers, isVideoEnabled }: Props) {
    const localVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    const remoteEntries = Object.entries(remotePeers).filter(
        ([_, peer]) => peer.stream
    );

    if (remoteEntries.length === 0 && !isVideoEnabled) {
        return null;
    }

    return (
        <div className="video-call">
            {/* Remote videos */}
            {remoteEntries.map(([id, peer]) => (
                <RemoteVideo key={id} peer={peer} />
            ))}

            {/* Local PiP */}
            {localStream && (
                <div className="video-local-pip">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`video-el ${!isVideoEnabled ? 'video-hidden' : ''}`}
                    />
                    {!isVideoEnabled && (
                        <div className="video-avatar-small">You</div>
                    )}
                </div>
            )}
        </div>
    );
}

function RemoteVideo({ peer }: { peer: Peer }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer.stream]);

    return (
        <div className="video-remote">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="video-el"
            />
            <span className="video-label">{peer.displayName}</span>
        </div>
    );
}
