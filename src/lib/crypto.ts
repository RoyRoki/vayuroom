import type { DerivedKeyResult } from '../types';

const PBKDF2_ITERATIONS = 600_000;
const AES_KEY_LENGTH = 256;

/** Convert ArrayBuffer to hex string */
function bufToHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/** Convert ArrayBuffer to base64 string */
export function bufToBase64(buf: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/** Convert base64 string to ArrayBuffer */
export function base64ToBuf(b64: string): ArrayBuffer {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        buf[i] = bin.charCodeAt(i);
    }
    return buf.buffer;
}

/**
 * Derive an AES-GCM-256 key + room hash from a passphrase.
 * Uses PBKDF2 with 600k iterations and SHA-256.
 */
export async function deriveKey(passphrase: string): Promise<DerivedKeyResult> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    // Salt = SHA-256 of "vayuroom" (deterministic so same passphrase → same room)
    const saltData = await crypto.subtle.digest(
        'SHA-256',
        encoder.encode('vayuroom-salt-v1')
    );

    // Derive AES key
    const aesKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: new Uint8Array(saltData),
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );

    // Room hash = SHA-256 of the passphrase (for Firebase path)
    const hashBuf = await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(passphrase)
    );
    const roomHash = bufToHex(hashBuf);

    return { aesKey, roomHash };
}

/**
 * Encrypt a plaintext message with AES-GCM-256.
 * Returns { encrypted, iv } as base64 strings.
 * IV is unique per message — NEVER reused.
 */
export async function encrypt(
    key: CryptoKey,
    plaintext: string
): Promise<{ encrypted: string; iv: string }> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // unique 96-bit IV
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plaintext)
    );
    return {
        encrypted: bufToBase64(ciphertext),
        iv: bufToBase64(iv.buffer),
    };
}

/**
 * Decrypt an AES-GCM-256 ciphertext.
 * Takes base64-encoded encrypted data and IV.
 */
export async function decrypt(
    key: CryptoKey,
    encrypted: string,
    iv: string
): Promise<string> {
    const decoder = new TextDecoder();
    const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(base64ToBuf(iv)) },
        key,
        base64ToBuf(encrypted)
    );
    return decoder.decode(plainBuf);
}
