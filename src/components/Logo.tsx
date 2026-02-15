import { Wind } from 'lucide-react';
import './Logo.css';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    return (
        <div className={`logo logo-${size}`}>
            <div className="logo-icon">
                <Wind />
            </div>
            <span className="logo-text">Vayuroom</span>
        </div>
    );
}
