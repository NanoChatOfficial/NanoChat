
import { useState, useEffect } from "react";
import { generateKeyString, generateRoomID } from "../utils/crypto";

export function useRoomManager() {
  const [key, setKey] = useState<string>(window.location.hash.slice(1));
  const match = window.location.pathname.match(/\/room\/([^/]+)/);
  const roomId = match ? match[1] : null;

  useEffect(() => {
    if (!roomId) {
      const newRoomId = generateRoomID();
      const keyString = generateKeyString();
      window.location.href = `${window.location.origin}/room/${newRoomId}#${keyString}`;
    }
  }, [roomId]);

  useEffect(() => {
    const onHashChange = () => setKey(window.location.hash.slice(1));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return { roomId, key };
}
