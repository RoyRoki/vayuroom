/**
 * ICE server configuration.
 * Uses Google public STUN + Metered.ca free TURN.
 * TURN credentials are fetched dynamically via Metered REST API.
 */

const METERED_DOMAIN = import.meta.env.VITE_METERED_DOMAIN;
const METERED_API_KEY = import.meta.env.VITE_METERED_API_KEY;

interface MeteredCredential {
    urls: string | string[];
    username?: string;
    credential?: string;
}

/** Fetch fresh TURN credentials from Metered.ca API */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
    const stun: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ];

    try {
        const res = await fetch(
            `https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
        );

        if (!res.ok) {
            console.warn('[ICE] Failed to fetch TURN credentials, using STUN only');
            return stun;
        }

        const turnServers: MeteredCredential[] = await res.json();
        return [
            ...stun,
            ...turnServers.map((s) => ({
                urls: s.urls,
                username: s.username,
                credential: s.credential,
            })),
        ];
    } catch (err) {
        console.warn('[ICE] TURN fetch error, falling back to STUN only:', err);
        return stun;
    }
}

/** Fallback: static STUN-only config (for offline dev) */
export const fallbackIceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];
