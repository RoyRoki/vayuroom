import { useEffect } from 'react';
import { Phone, PhoneOff, Lock } from 'lucide-react';
import type { IncomingCallInfo } from '../types';
import { useSound } from '../hooks/useSound';
import './IncomingCall.css';

interface Props {
    callInfo: IncomingCallInfo;
    onAccept: () => void;
    onDecline: () => void;
}

export function IncomingCall({ callInfo, onAccept, onDecline }: Props) {
    const { playSound } = useSound();

    // Loop incoming call ring sound every 2 seconds
    useEffect(() => {
        playSound('call-incoming');
        const interval = setInterval(() => {
            playSound('call-incoming');
        }, 2000);
        return () => clearInterval(interval);
    }, [playSound]);
    return (
        <div className="incoming-call-overlay">
            {/* Top */}
            <div className="incoming-call-top">
                <span className="incoming-call-label">Vroom</span>
                <span className="incoming-call-encrypt">
                    <Lock size={10} />
                    End-to-end encrypted
                </span>
            </div>

            {/* Center — Avatar + Info */}
            <div className="incoming-call-center">
                <div className="incoming-call-avatar-wrap">
                    <div className="incoming-call-avatar">
                        <div className="incoming-call-avatar-inner">
                            <Phone size={48} className="incoming-call-avatar-icon" />
                        </div>
                    </div>
                    {/* Ringing pulse rings */}
                    <div className="incoming-call-ring incoming-call-ring--1" />
                    <div className="incoming-call-ring incoming-call-ring--2" />
                    <div className="incoming-call-ring incoming-call-ring--3" />
                </div>

                <div className="incoming-call-info">
                    <span className="incoming-call-name">{callInfo.callerName}</span>
                    <div className="incoming-call-status-wrap">
                        <Phone size={16} className="incoming-call-phone-icon" />
                        <span className="incoming-call-status">
                            {callInfo.callType === 'video' ? 'Video' : 'Audio'} Call
                        </span>
                        <div className="incoming-call-dots">
                            <span>.</span><span>.</span><span>.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom — Accept / Decline */}
            <div className="incoming-call-actions">
                <button className="incoming-call-btn incoming-call-btn--decline" onClick={onDecline}>
                    <PhoneOff size={24} />
                    <span className="incoming-call-btn-label">Decline</span>
                </button>

                <button className="incoming-call-btn incoming-call-btn--accept" onClick={onAccept}>
                    <Phone size={24} />
                    <span className="incoming-call-btn-label">Accept</span>
                </button>
            </div>
        </div>
    );
}
