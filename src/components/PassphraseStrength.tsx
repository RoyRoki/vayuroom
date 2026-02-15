import './PassphraseStrength.css';
import { passphraseStrength } from '../lib/utils';

interface Props {
    passphrase: string;
}

const LABELS = {
    weak: 'Weak — easily guessable',
    fair: 'Fair — could be stronger',
    strong: 'Strong — good security',
    excellent: 'Excellent — very secure',
};

export function PassphraseStrength({ passphrase }: Props) {
    const strength = passphraseStrength(passphrase);

    if (!passphrase.trim()) return null;

    return (
        <div className="strength">
            <div className="strength-bar">
                <div className={`strength-fill strength-${strength}`} />
            </div>
            <span className={`strength-label strength-label-${strength}`}>
                {LABELS[strength]}
            </span>
        </div>
    );
}
