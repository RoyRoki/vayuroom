import React from 'react';
import './PermissionDeniedModal.css';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onRetry: () => void;
}

export function PermissionDeniedModal({ isOpen, onClose, onRetry }: Props) {
    if (!isOpen) return null;

    return (
        <div className="permission-modal-overlay">
            <div className="permission-modal">
                <div className="permission-icon-wrapper">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                </div>

                <h3 className="permission-title">Permission Required</h3>

                <p className="permission-description">
                    Vayuroom needs access to your camera and microphone to make calls.
                    Please check your browser settings and allow access.
                </p>

                <div className="permission-actions">
                    <button className="permission-btn primary" onClick={onRetry}>
                        Try Again
                    </button>
                    <button className="permission-btn secondary" onClick={onClose}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
