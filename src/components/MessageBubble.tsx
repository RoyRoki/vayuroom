import { formatTime } from '../lib/utils';
import type { Message } from '../types';

interface Props {
    message: Message;
    isSelf: boolean;
}

export function MessageBubble({ message, isSelf }: Props) {
    return (
        <div className={`bubble-wrap ${isSelf ? 'bubble-self' : 'bubble-other'} animate-fade-in-up`}>
            {!isSelf && (
                <span className="bubble-name">{message.senderName}</span>
            )}
            <div className={`bubble ${isSelf ? 'bubble-blue' : 'bubble-gray'}`}>
                <p className="bubble-text">{message.text}</p>
            </div>
            <span className="bubble-time">{formatTime(message.timestamp)}</span>
        </div>
    );
}
