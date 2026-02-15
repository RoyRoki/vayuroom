import { useState, useCallback } from 'react';
import { deriveKey } from '../lib/crypto';
import type { DerivedKeyResult } from '../types';

interface UseCryptoReturn {
    derived: DerivedKeyResult | null;
    isLoading: boolean;
    error: string | null;
    derive: (passphrase: string) => Promise<DerivedKeyResult | null>;
    reset: () => void;
}

export function useCrypto(): UseCryptoReturn {
    const [derived, setDerived] = useState<DerivedKeyResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const derive = useCallback(async (passphrase: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await deriveKey(passphrase);
            setDerived(result);
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Key derivation failed';
            setError(msg);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setDerived(null);
        setError(null);
    }, []);

    return { derived, isLoading, error, derive, reset };
}
