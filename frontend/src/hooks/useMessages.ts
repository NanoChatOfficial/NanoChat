import { useState, useEffect } from "react";
import { fetchMessagesAPI } from "../api";
import { hexToUint8Array, decrypt } from "../utils/crypto";
import type { Message } from "../App";

export function useMessages(roomId: string | null, key: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!roomId) return;

    const fetchMessages = async () => {
      try {
        const response = await fetchMessagesAPI(roomId);
        const keyBytes = hexToUint8Array(key);
        const decryptedMessages: Message[] = [];

        for (const msg of response.data) {
          try {
            if (!msg.content || !msg.user || !msg.iv || !msg.user_iv) {
              console.error(
                "Malformed message received, skipping decryption:",
                msg
              );
              continue;
            }

            const [content, user] = await Promise.all([
              decrypt(
                hexToUint8Array(msg.content),
                keyBytes,
                hexToUint8Array(msg.iv)
              ),
              decrypt(
                hexToUint8Array(msg.user),
                keyBytes,
                hexToUint8Array(msg.user_iv)
              ),
            ]);
            decryptedMessages.push({
              id: msg.id,
              user,
              content,
              timestamp: msg.timestamp,
            });
          } catch (error) {
            console.error("Error decrypting message:", error);
          }
        }
        setMessages(decryptedMessages);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    fetchMessages(); // initial fetch

    const interval = setInterval(fetchMessages, 1000); // fetch every second

    return () => clearInterval(interval); // cleanup on unmount
  }, [roomId, key]);

  return messages;
}
