import './Logo.css';

export function Logo({ size = 'md', iconOverlay }: { size?: 'sm' | 'md' | 'lg', iconOverlay?: React.ReactNode }) {
    return (
        <div className={`logo logo-${size}`}>
            <div className="logo-icon-container" style={{ position: 'relative' }}>
                <div className="logo-icon">
                    <img src="/pwa-icon.svg" alt="Vroom Logo" style={{ width: '100%', height: '100%' }} />
                </div>
                {iconOverlay}
            </div>
            <span className="logo-text">Vroom</span>
        </div>
    );
}
