import { useState, useCallback, useRef } from 'react';

interface UseMediaReturn {
    localStream: MediaStream | null;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    startMedia: (video?: boolean) => Promise<MediaStream>;
    stopMedia: () => void;
    toggleAudio: () => Promise<void>;
    toggleVideo: () => Promise<void>;
    switchCamera: () => Promise<MediaStream | null>;
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
        // Check if any audio input devices exist
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasAudio = devices.some(d => d.kind === 'audioinput');
        if (!hasAudio) {
            throw new Error('No microphone found on this device');
        }

        try {
            // Try with detailed constraints first
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
        } catch {
            // Fallback: try with simple constraints
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: video,
            });
            setLocalStream(stream);
            setIsAudioEnabled(true);
            setIsVideoEnabled(video);
            return stream;
        }
    }, []);

    const stopMedia = useCallback(() => {
        localStream?.getTracks().forEach((t) => t.stop());
        blackTrackRef.current?.stop();
        setLocalStream(null);
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);
    }, [localStream]);

    const toggleAudio = useCallback(async () => {
        if (!localStream) return;
        const track = localStream.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setIsAudioEnabled(track.enabled);
        } else {
            // No audio track? Try to add one (unlikely for audio-first, but possible)
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const newTrack = newStream.getAudioTracks()[0];
                if (newTrack) {
                    localStream.addTrack(newTrack);
                    setIsAudioEnabled(true);
                }
            } catch (err) {
                console.error('Failed to add audio track:', err);
            }
        }
    }, [localStream]);

    const toggleVideo = useCallback(async () => {
        if (!localStream) return;
        const track = localStream.getVideoTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setIsVideoEnabled(track.enabled);
        } else {
            // No video track (e.g. started as audio only). Request one.
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user',
                    }
                });
                const newTrack = newStream.getVideoTracks()[0];
                if (newTrack) {
                    localStream.addTrack(newTrack);
                    setIsVideoEnabled(true);
                }
            } catch (err) {
                console.error('Failed to add video track:', err);
            }
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

    /** Switch between available video devices */
    const switchCamera = useCallback(async () => {
        if (!localStream) return null; // Can't switch if no stream

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            if (videoDevices.length < 2) {
                console.warn('Only one video device found');
                return localStream;
            }

            const currentTrack = localStream.getVideoTracks()[0];
            const currentLabel = currentTrack?.label || '';

            // Find current device index
            const currentIndex = videoDevices.findIndex(d => d.label === currentLabel);
            // Pick next device (cycle)
            const nextDevice = videoDevices[(currentIndex + 1) % videoDevices.length];
            if (!nextDevice) {
                console.warn('No next device found');
                return localStream;
            }

            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: nextDevice.deviceId }
                },
                audio: isAudioEnabled // Keep audio setting
            });

            // Allow stopping current track
            currentTrack?.stop();

            const newVideoTrack = newStream.getVideoTracks()[0];
            const oldAudioTrack = localStream.getAudioTracks()[0];

            // Filter out undefined tracks to satisfy MediaStream constructor
            const tracks: MediaStreamTrack[] = [oldAudioTrack, newVideoTrack].filter((t): t is MediaStreamTrack => !!t);

            const combinedStream = new MediaStream(tracks);

            setLocalStream(combinedStream);
            setIsVideoEnabled(true);
            return combinedStream;

        } catch (err) {
            console.error('Failed to switch camera:', err);
            return localStream;
        }
    }, [localStream, isAudioEnabled]);

    return {
        localStream,
        isAudioEnabled,
        isVideoEnabled,
        startMedia,
        stopMedia,
        toggleAudio,
        toggleVideo,
        switchCamera,
        getBlackVideoTrack,
    };
}
