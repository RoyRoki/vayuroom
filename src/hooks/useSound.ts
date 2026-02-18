import { useCallback, useRef } from 'react';
import { useRoomStore } from '../store/useRoomStore';

export type SoundType =
    | 'message-send'       // Sent a chat message
    | 'message-receive'    // Received a chat message
    | 'join'               // Peer joined room
    | 'leave'              // Peer left room
    | 'call-outgoing'      // Ringback for caller (looped externally)
    | 'call-incoming'      // Incoming call ring phrase (looped externally)
    | 'call-answered'      // Call was answered/connected
    | 'call-end'           // Call ended/disconnected
    | 'call-declined'      // Call was declined
    | 'mic-on'             // Microphone unmuted
    | 'mic-off'            // Microphone muted
    | 'cam-on'             // Camera turned on
    | 'cam-off'            // Camera turned off
    | 'cam-flip'           // Camera switched
    | 'tap';               // Generic UI tap

export function useSound() {
    const isSoundEnabled = useRoomStore((s) => s.isSoundEnabled);
    const audioContextRef = useRef<AudioContext | null>(null);

    const getContext = useCallback(() => {
        if (!audioContextRef.current) {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            if (Ctx) audioContextRef.current = new Ctx();
        }
        const ctx = audioContextRef.current;
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { });
        return ctx;
    }, []);

    /** Low-level tone with click-free envelope */
    const tone = useCallback((freq: number, wave: OscillatorType, dur: number, delay = 0, vol = 0.08) => {
        const ctx = getContext();
        if (!ctx) return;

        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = wave;
        osc.frequency.setValueAtTime(freq, t);

        // Smooth envelope: silent → vol → silence
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.005);
        gain.gain.setValueAtTime(vol, t + dur * 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
    }, [getContext]);

    const playSound = useCallback((type: SoundType) => {
        if (!isSoundEnabled) return;

        switch (type) {
            /* ── Chat ── */
            case 'message-send':
                // Whoosh-up: quick ascending
                tone(600, 'sine', 0.08, 0, 0.06);
                tone(900, 'sine', 0.06, 0.06, 0.04);
                break;

            case 'message-receive':
                // Pop: two-note ding
                tone(784, 'sine', 0.08, 0, 0.07);
                tone(1047, 'sine', 0.12, 0.07, 0.05);
                break;

            /* ── Room presence ── */
            case 'join':
                // Rising chime: E5 → G5
                tone(659, 'sine', 0.15, 0);
                tone(784, 'sine', 0.3, 0.12);
                break;

            case 'leave':
                // Falling chime: A4 → F4
                tone(440, 'sine', 0.15, 0);
                tone(349, 'sine', 0.25, 0.12);
                break;

            /* ── Calling ── */
            case 'call-outgoing':
                // Soft ringback pulse (440 Hz, 1s)
                tone(440, 'sine', 1.0, 0, 0.06);
                break;

            case 'call-incoming':
                // Two-pulse ring with harmony
                // Pulse 1
                tone(440, 'sine', 0.08, 0, 0.08);
                tone(440, 'sine', 0.08, 0.12, 0.08);
                tone(440, 'sine', 0.15, 0.25, 0.08);
                // Harmonic layer
                tone(554, 'sine', 0.08, 0, 0.04);
                tone(554, 'sine', 0.08, 0.12, 0.04);
                tone(554, 'sine', 0.15, 0.25, 0.04);
                break;

            case 'call-answered':
                // Connected chime: C5 → E5 → G5
                tone(523, 'sine', 0.12, 0, 0.07);
                tone(659, 'sine', 0.12, 0.1, 0.07);
                tone(784, 'sine', 0.25, 0.2, 0.07);
                break;

            case 'call-end':
                // Disconnect: three descending tones
                tone(440, 'sine', 0.1, 0, 0.06);
                tone(349, 'sine', 0.1, 0.1, 0.06);
                tone(261, 'sine', 0.2, 0.2, 0.06);
                break;

            case 'call-declined':
                // Busy: two low beeps
                tone(480, 'square', 0.15, 0, 0.04);
                tone(480, 'square', 0.15, 0.25, 0.04);
                break;

            /* ── Controls ── */
            case 'mic-on':
                // Quick ascending blip
                tone(500, 'sine', 0.06, 0, 0.05);
                tone(700, 'sine', 0.08, 0.05, 0.05);
                break;

            case 'mic-off':
                // Quick descending blip
                tone(700, 'sine', 0.06, 0, 0.05);
                tone(500, 'sine', 0.08, 0.05, 0.05);
                break;

            case 'cam-on':
                // Shutter open
                tone(600, 'triangle', 0.05, 0, 0.05);
                tone(800, 'triangle', 0.08, 0.04, 0.05);
                break;

            case 'cam-off':
                // Shutter close
                tone(800, 'triangle', 0.05, 0, 0.05);
                tone(600, 'triangle', 0.08, 0.04, 0.05);
                break;

            case 'cam-flip':
                // Click
                tone(1200, 'triangle', 0.04, 0, 0.06);
                break;

            case 'tap':
                // Subtle button tap
                tone(1000, 'triangle', 0.03, 0, 0.04);
                break;
        }
    }, [isSoundEnabled, tone]);

    return { playSound };
}
