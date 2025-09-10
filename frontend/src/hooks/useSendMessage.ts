import { useEffect, useRef, useState } from "react";
import { hexToUint8Array, generateIv, encrypt } from "../utils/crypto";

const useSendMessage = (roomId: string, roomKey: string) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [_connected, setConnected] = useState(false);

  const WS_BASE = import.meta.env.VITE_WS_BASE || "ws://localhost:8000";

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`${WS_BASE}/ws/rooms/${roomId}/`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setConnected(true);
      };

      ws.onclose = (e) => {
        console.log(`WebSocket disconnected. Reconnecting in 1s...`, e.reason);
        setConnected(false);
        setTimeout(connect, 1000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close();
      };

      ws.onmessage = (event) => {
        console.log("Received:", event.data);
      };
    };

    connect();

    return () => wsRef.current?.close();
  }, [roomId]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const keyBytes = hexToUint8Array(roomKey);
      const user = localStorage.getItem("username");
      if (!user) {
        console.error("Username not found in localStorage. Please login again.");
        return;
      }

      const iv = generateIv();
      const user_iv = generateIv();

      const [encryptedContent, encryptedUser] = await Promise.all([
        encrypt(content, keyBytes, hexToUint8Array(iv)),
        encrypt(user, keyBytes, hexToUint8Array(user_iv)),
      ]);

      const messageData = {
        type: "new_message",
        content: encryptedContent.encrypted,
        iv,
        user: encryptedUser.encrypted,
        user_iv,
      };

      wsRef.current.send(JSON.stringify(messageData));
    } catch (err) {
      console.error("Error encrypting/sending message:", err);
    }
  };

  return sendMessage;
};

export default useSendMessage;