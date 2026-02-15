/**
 * Utility functions for Vayuroom.
 */

/* ── Diceware-style word list (compact) ── */
const WORDS = [
    'alpha', 'bravo', 'cedar', 'delta', 'eagle', 'flame', 'ghost', 'haven', 'ivory', 'jewel',
    'karma', 'lunar', 'maple', 'nexus', 'ocean', 'prism', 'quest', 'ridge', 'solar', 'tiger',
    'ultra', 'vivid', 'whale', 'xenon', 'yield', 'zebra', 'amber', 'blaze', 'coral', 'drift',
    'ember', 'frost', 'grain', 'haste', 'inlet', 'joker', 'kneel', 'lotus', 'mirth', 'noble',
    'orbit', 'pearl', 'quilt', 'rover', 'shade', 'torch', 'unity', 'vault', 'wield', 'zephyr',
    'arrow', 'bloom', 'cliff', 'dunes', 'epoch', 'forge', 'gleam', 'hover', 'irony', 'pulse',
    'night', 'spark', 'stone', 'swift', 'trace', 'verse', 'woven', 'crisp', 'flint', 'brave',
    'steel', 'cloud', 'forge', 'glyph', 'heart', 'iris', 'jade', 'knot', 'latch', 'marsh',
    'north', 'olive', 'plume', 'raven', 'surge', 'thorn', 'vigor', 'weave', 'onyx', 'bloom',
    'crane', 'dawn', 'flora', 'grove', 'hyper', 'atlas', 'byte', 'cypher', 'drone', 'ether',
];

/**
 * Generate a random passphrase (5–7 diceware-style words).
 */
export function generatePassphrase(wordCount = 5): string {
    const values = crypto.getRandomValues(new Uint32Array(wordCount));
    return Array.from(values)
        .map((v) => WORDS[v % WORDS.length]!)
        .join('-');
}

/**
 * Generate a short random peer ID.
 * Format: "User-XXXX" where X is hex.
 */
export function generatePeerId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(2));
    const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    return `User-${hex}`;
}

/**
 * Generate a unique signal/message ID.
 */
export function generateId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Estimate passphrase strength.
 * Returns 'weak' | 'fair' | 'strong' | 'excellent'.
 */
export function passphraseStrength(
    passphrase: string
): 'weak' | 'fair' | 'strong' | 'excellent' {
    const trimmed = passphrase.trim();
    if (trimmed.length === 0) return 'weak';

    // Check if it looks like a generated passphrase (words separated by hyphens)
    const words = trimmed.split(/[-\s]+/).filter(Boolean);
    if (words.length >= 6) return 'excellent';
    if (words.length >= 5) return 'strong';
    if (words.length >= 4) return 'fair';

    // Fallback: check raw length + complexity
    if (trimmed.length >= 20) return 'strong';
    if (trimmed.length >= 12) return 'fair';
    return 'weak';
}

/**
 * Current Unix timestamp in milliseconds.
 */
export function now(): number {
    return Date.now();
}

/**
 * Format a timestamp for display.
 */
export function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
