import { useState, useEffect, useRef } from "react";
import { hexToUint8Array, decrypt } from "../utils/crypto";
import type { Message } from "../App";

export function useMessages(roomId: string | null, key: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const keyBytes = hexToUint8Array(key);
    const WS_BASE = import.meta.env.VITE_WS_BASE || "ws://localhost:8000";
    const wsUrl = `${WS_BASE}/ws/messages/${roomId}/`;

    let ws: WebSocket;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected:", wsUrl);
        ws.send(JSON.stringify({ action: "fetch" }));
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          let newMessages: Message[] = [];

          if (data.type === "history" && Array.isArray(data.messages)) {
            newMessages = data.messages;
          } else if (data.type === "message" && data.message) {
            newMessages = [data.message];
          }

          const decryptedMessages: Message[] = [];

          for (const msg of newMessages) {
            if (!msg.content || !msg.user || !msg.iv || !msg.user_iv) {
              console.error("Malformed message, skipping:", msg);
              continue;
            }

            try {
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
                user_iv: msg.user_iv,
                content,
                iv: msg.iv,
                timestamp: msg.timestamp,
              });
            } catch (err) {
              console.error("Decryption error:", err);
            }
          }

          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const merged = [...prev, ...decryptedMessages.filter((m) => !ids.has(m.id))];
            return merged.sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        } catch (err) {
          console.error("WebSocket message parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected. Reconnecting in 1s...");
        setTimeout(connect, 1000);
      };
    };

    connect();

    return () => {
      ws?.close();
    };
  }, [roomId, key]);

  return messages;
}
