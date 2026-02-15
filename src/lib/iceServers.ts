/**
 * ICE server configuration.
 * Uses Google public STUN + ExpressTURN (Free Tier).
 */

const TURN_URL = import.meta.env.VITE_TURN_URL;
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL;

/** Return the configured ICE servers */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
    const iceServers: RTCIceServer[] = [
        // Google STUN
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ];

    // Add ExpressTURN if configured
    if (TURN_URL && TURN_USERNAME && TURN_CREDENTIAL) {
        iceServers.push({
            urls: TURN_URL,
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL,
        });
    }

    return iceServers;
}

/** Fallback (same as main function for static config) */
export const fallbackIceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];
