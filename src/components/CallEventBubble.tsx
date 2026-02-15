import { Phone, PhoneOff, PhoneMissed } from 'lucide-react';
import { formatTime } from '../lib/utils';
import type { CallEventData } from '../types';
import './CallEventBubble.css';

interface Props {
    callEvent: CallEventData;
    timestamp: number;
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CallEventBubble({ callEvent, timestamp }: Props) {
    const { callerName, callStatus, callStartTime, callEndTime, callDuration } = callEvent;

    const isCompleted = callStatus === 'completed';
    const isMissed = callStatus === 'missed';

    return (
        <div className={`call-event-bubble call-event-bubble--${callStatus}`}>
            <div className="call-event-icon-wrap">
                {isCompleted ? (
                    <Phone size={18} className="call-event-icon call-event-icon--completed" />
                ) : isMissed ? (
                    <PhoneMissed size={18} className="call-event-icon call-event-icon--missed" />
                ) : (
                    <PhoneOff size={18} className="call-event-icon call-event-icon--declined" />
                )}
            </div>

            <div className="call-event-content">
                <span className="call-event-title">
                    {callerName}
                    {isCompleted && ' · Audio Call'}
                    {isMissed && ' · Missed audio call'}
                    {callStatus === 'declined' && ' · Declined audio call'}
                </span>

                <span className="call-event-detail">
                    {isCompleted && callStartTime && callEndTime ? (
                        <>
                            {formatTime(callStartTime)} to {formatTime(callEndTime)}
                            {callDuration !== undefined && (
                                <> · {formatDuration(callDuration)}</>
                            )}
                        </>
                    ) : (
                        formatTime(timestamp)
                    )}
                </span>
            </div>
        </div>
    );
}
