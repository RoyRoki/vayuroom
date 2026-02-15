import { useEffect, useCallback } from 'react';
import {
    ref,
    push,
    set,
    onChildAdded,
    off,
    query,
    limitToLast
} from 'firebase/database';
import { db } from '../lib/firebase';
import { useRoomStore } from '../store/useRoomStore';
import { encrypt, decrypt } from '../lib/crypto';
import { generateId, now } from '../lib/utils';
import type { Message } from '../types';

interface UseChatProps {
    roomHash: string;
    peerId: string;
    displayName: string;
    aesKey: CryptoKey | null;
}

export function useChat({ roomHash, peerId, displayName, aesKey }: UseChatProps) {
    const addMessage = useRoomStore((s) => s.addMessage);

    const sendMessage = useCallback(async (text: string) => {
        if (!roomHash || !aesKey) return;

        const { encrypted, iv } = await encrypt(aesKey, text);
        const msg: Message = {
            id: generateId(),
            senderId: peerId,
            senderName: displayName,
            text, // Local needs plain text immediately
            timestamp: now(),
            encrypted,
            iv,
        };

        // Push to Firebase
        const chatRef = ref(db, `rooms/${roomHash}/chat`);
        const newMsgRef = push(chatRef);

        // We only store the encrypted parts and metadata
        const payload = {
            id: msg.id,
            senderId: msg.senderId,
            senderName: msg.senderName,
            timestamp: msg.timestamp,
            encrypted: msg.encrypted,
            iv: msg.iv,
        };

        await set(newMsgRef, payload);
    }, [roomHash, peerId, displayName, aesKey]);

    useEffect(() => {
        if (!roomHash || !aesKey) return;

        const chatRef = query(ref(db, `rooms/${roomHash}/chat`), limitToLast(50));

        const handleNewMessage = async (snapshot: any) => {
            const data = snapshot.val() as Message;
            if (!data) return;

            // Decrypt if it's from someone else (or even if it's us, to confirm receipt?)
            // Actually, we can just decrypt everything coming in.
            // If it's our own message, we might have ALREADY added it optimistically?
            // For simplicity, let's rely on the store's deduplication if it exists, or just check IDs.

            try {
                // If text is missing (it should be for others), decrypt it
                let text = data.text;
                if (!text && data.encrypted && data.iv) {
                    text = await decrypt(aesKey, data.encrypted, data.iv);
                }

                // If we still don't have text and it's not us (who might have sent it with text locally)
                // Actually, we should probably just ALWAYS decrypt to be safe and consistent
                if (data.encrypted && data.iv) {
                    text = await decrypt(aesKey, data.encrypted, data.iv);
                }

                addMessage({
                    ...data,
                    text
                });
            } catch (error) {
                console.error("Failed to decrypt message", error);
            }
        };

        onChildAdded(chatRef, handleNewMessage);

        return () => {
            off(chatRef, 'child_added', handleNewMessage);
        };
    }, [roomHash, aesKey, addMessage]);

    return { sendMessage };
}
