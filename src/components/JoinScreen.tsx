import { useState } from 'react';
import { Logo } from './Logo';
import { PassphraseStrength } from './PassphraseStrength';
import { generatePassphrase } from '../lib/utils';
import { Shield, Shuffle, ArrowRight, Users, EyeOff, Loader2 } from 'lucide-react';
import './JoinScreen.css';

interface Props {
    onJoin: (passphrase: string) => void;
    isLoading: boolean;
}

export function JoinScreen({ onJoin, isLoading }: Props) {
    const [passphrase, setPassphrase] = useState('');
    const [showPassphrase, setShowPassphrase] = useState(false);

    const handleGenerate = () => {
        const key = generatePassphrase(5);
        setPassphrase(key);
        setShowPassphrase(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passphrase.trim().length > 0 && !isLoading) {
            onJoin(passphrase.trim());
        }
    };

    return (
        <div className="join-screen">
            <div className="join-card animate-scale-in">
                <Logo size="lg" />
                <p className="join-tagline">
                    Encrypted rooms. No login. No history.
                </p>

                <form onSubmit={handleSubmit} className="join-form">
                    <div className="join-input-group">
                        <div className="join-input-wrapper">

                            <input
                                type={showPassphrase ? 'text' : 'password'}
                                className="input input-lg join-input"
                                placeholder="Enter shared secret..."
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                                autoFocus
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <button
                                type="button"
                                className="join-eye-btn"
                                onClick={() => setShowPassphrase(!showPassphrase)}
                            >
                                <EyeOff size={18} />
                            </button>
                        </div>
                        <PassphraseStrength passphrase={passphrase} />
                    </div>

                    <button
                        type="button"
                        className="btn btn-ghost btn-full join-generate"
                        onClick={handleGenerate}
                    >
                        <Shuffle size={16} />
                        Generate secure key
                    </button>

                    <button
                        type="submit"
                        className="btn btn-gradient btn-lg btn-full"
                        disabled={!passphrase.trim() || isLoading}
                    >
                        {isLoading ? (
                            <Loader2 size={20} className="animate-spin text-primary" />
                        ) : (
                            <>
                                Join Room
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <div className="join-features">
                    <div className="join-feature">
                        <Shield size={14} />
                        <span>End-to-end encrypted</span>
                    </div>
                    <div className="join-feature">
                        <EyeOff size={14} />
                        <span>No account needed</span>
                    </div>
                    <div className="join-feature">
                        <Users size={14} />
                        <span>Max 3 people</span>
                    </div>
                </div>
            </div>

            <p className="join-footer text-tertiary text-xs text-center">
                Share the same secret with your group to join the same room.
                <br />
                Everything disappears when everyone leaves.
            </p>
        </div>
    );
}
