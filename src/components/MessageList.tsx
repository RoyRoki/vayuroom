import { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { MessageCircle } from 'lucide-react';
import type { Message } from '../types';
import './MessageList.css';

interface Props {
    messages: Message[];
    localPeerId: string;
}

export function MessageList({ messages, localPeerId }: Props) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    if (messages.length === 0) {
        return (
            <div className="message-list-empty">
                <MessageCircle size={40} />
                <p>No messages yet</p>
                <span>Messages are end-to-end encrypted and disappear when everyone leaves.</span>
            </div>
        );
    }

    return (
        <div className="message-list">
            {messages.map((msg) => (
                msg.type === 'system' ? (
                    <div key={msg.id} className="system-message">
                        {msg.text}
                    </div>
                ) : (
                    <MessageBubble
                        key={msg.id}
                        message={msg}
                        isSelf={msg.senderId === localPeerId}
                    />
                )
            ))}
            <div ref={bottomRef} />
        </div>
    );
}
