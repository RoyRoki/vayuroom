import { useState, useCallback, useRef } from 'react';

interface UseMediaReturn {
    localStream: MediaStream | null;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    startMedia: (video?: boolean) => Promise<MediaStream>;
    stopMedia: () => void;
    toggleAudio: () => void;
    toggleVideo: () => void;
    getBlackVideoTrack: () => MediaStreamTrack;
}

/**
 * Hook for managing local media devices.
 * Uses `track.enabled` for toggling (no renegotiation needed).
 */
export function useMediaDevices(): UseMediaReturn {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const blackTrackRef = useRef<MediaStreamTrack | null>(null);

    const startMedia = useCallback(async (video = false): Promise<MediaStream> => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
            video: video
                ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                }
                : false,
        });

        setLocalStream(stream);
        setIsAudioEnabled(true);
        setIsVideoEnabled(video);
        return stream;
    }, []);

    const stopMedia = useCallback(() => {
        localStream?.getTracks().forEach((t) => t.stop());
        blackTrackRef.current?.stop();
        setLocalStream(null);
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);
    }, [localStream]);

    const toggleAudio = useCallback(() => {
        if (!localStream) return;
        const track = localStream.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setIsAudioEnabled(track.enabled);
        }
    }, [localStream]);

    const toggleVideo = useCallback(() => {
        if (!localStream) return;
        const track = localStream.getVideoTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setIsVideoEnabled(track.enabled);
        }
    }, [localStream]);

    /** Create a silent black video track (for when camera is off) */
    const getBlackVideoTrack = useCallback((): MediaStreamTrack => {
        if (blackTrackRef.current && blackTrackRef.current.readyState === 'live') {
            return blackTrackRef.current;
        }
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 640, 480);
        const stream = canvas.captureStream(1);
        const track = stream.getVideoTracks()[0]!;
        blackTrackRef.current = track;
        return track;
    }, []);

    return {
        localStream,
        isAudioEnabled,
        isVideoEnabled,
        startMedia,
        stopMedia,
        toggleAudio,
        toggleVideo,
        getBlackVideoTrack,
    };
}
