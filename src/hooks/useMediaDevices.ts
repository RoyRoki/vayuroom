import { useState, useCallback, useRef, useEffect } from 'react';

interface UseMediaReturn {
    localStream: MediaStream | null;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isScreenSharing: boolean;
    startMedia: (video?: boolean) => Promise<MediaStream>;
    stopMedia: () => void;
    toggleAudio: () => Promise<void>;
    toggleVideo: () => Promise<void>;
    startScreenShare: () => Promise<MediaStream | null>;
    stopScreenShare: () => Promise<MediaStream | null>;
    switchCamera: () => Promise<MediaStream | null>;
    getBlackVideoTrack: () => MediaStreamTrack;
    isScreenShareSupported: boolean;
}

/**
 * Hook for managing local media devices.
 * Uses `track.enabled` for toggling (no renegotiation needed).
 */
export function useMediaDevices(): UseMediaReturn {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const blackTrackRef = useRef<MediaStreamTrack | null>(null);
    const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);

    const [isScreenShareSupported, setIsScreenShareSupported] = useState(false);

    useEffect(() => {
        // Check if getDisplayMedia is supported
        if (typeof navigator !== 'undefined' && navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) {
            setIsScreenShareSupported(true);
        } else {
            setIsScreenShareSupported(false);
        }
    }, []);

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
            setIsScreenSharing(false);
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
            setIsScreenSharing(false);
            return stream;
        }
    }, []);

    const stopMedia = useCallback(() => {
        localStream?.getTracks().forEach((t) => t.stop());
        blackTrackRef.current?.stop();
        originalVideoTrackRef.current = null;
        setLocalStream(null);
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);
        setIsScreenSharing(false);
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

        // If screen sharing, stop it and revert to camera (or generate new camera stream)
        if (isScreenSharing) {
            await stopScreenShare();
            // stopScreenShare reverts to camera if it was there, or might leave us with audio only.
            // If we want to ensure video is ON after stopping screen share, we might need to explicit start camera.
            // But for now, let's just let stopScreenShare handle the revert.
            return;
        }

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
    }, [localStream, isScreenSharing]);

    const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
        if (!localStream) return null;

        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false // System audio sharing is tricky and often not supported cleanly mixed with mic
            });
            const screenTrack = displayStream.getVideoTracks()[0];

            if (!screenTrack) {
                throw new Error('No video track found in screen share stream');
            }

            // Save current camera track if exists
            const currentVideoTrack = localStream.getVideoTracks()[0];
            if (currentVideoTrack) {
                originalVideoTrackRef.current = currentVideoTrack;
                // Don't stop it, just remove it from stream? Or stop it to save resources?
                // Better to stop it to turn off camera light, but then we can't easily resume without permissions.
                // Actually, replaceTrack in WebRTC handles stream mod, but for localStream we need to swap tracks.
                localStream.removeTrack(currentVideoTrack);
                // currentVideoTrack.stop(); // If we stop, we need getUserMedia again to resume.
                // Let's NOT stop it if we want fast resume, but browser might show camera light ON.
                // For simplicity and privacy, let's stop the camera track.
                currentVideoTrack.stop();
            }

            localStream.addTrack(screenTrack);
            setIsScreenSharing(true);
            setIsVideoEnabled(true); // Screen share is video

            // Handle user clicking "Stop sharing" in browser UI
            screenTrack.onended = () => {
                stopScreenShare();
            };

            return localStream;
        } catch (err) {
            console.error('Failed to start screen share:', err);
            return null;
        }
    }, [localStream]);

    const stopScreenShare = useCallback(async (): Promise<MediaStream | null> => {
        if (!localStream) return null;

        const screenTrack = localStream.getVideoTracks()[0];
        if (screenTrack) {
            screenTrack.stop();
            localStream.removeTrack(screenTrack);
        }

        setIsScreenSharing(false);
        setIsVideoEnabled(false); // Default to off, let toggleVideo turn it on if needed

        // Revert to camera? 
        // Since we stopped the camera track earlier to save resources/privacy, we need to request it again.
        // We will leave it as audio-only for now, user can enable video manually.
        // OR we can auto-start camera if it was on before.
        // Let's auto-start camera to be nice.
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                }
            });
            const newVideoTrack = newStream.getVideoTracks()[0];
            if (newVideoTrack) {
                localStream.addTrack(newVideoTrack);
                setIsVideoEnabled(true);
            }
        } catch {
            // failed to restart camera, user stays audio only
        }

        return localStream;
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
        if (!localStream || isScreenSharing) return null; // Can't switch if no stream or screen sharing

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
    }, [localStream, isAudioEnabled, isScreenSharing]);

    return {
        localStream,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        startMedia,
        stopMedia,
        toggleAudio,
        toggleVideo,
        startScreenShare,
        stopScreenShare,
        switchCamera,
        getBlackVideoTrack,
        isScreenShareSupported,
    };
}
