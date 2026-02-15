import './StatusIndicator.css';

interface Props {
    status: 'online' | 'connecting' | 'offline';
    label?: string;
}

export function StatusIndicator({ status, label }: Props) {
    return (
        <span className={`status-indicator status-${status}`}>
            <span className="status-dot">
                {status === 'connecting' && <span className="status-ring" />}
            </span>
            {label && <span className="status-label">{label}</span>}
        </span>
    );
}
