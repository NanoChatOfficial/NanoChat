import axios from "axios";
import { hexToUint8Array, generateIv, encrypt } from "../utils/crypto";

export const useSendMessage = (roomId: string, roomKey: string) => {
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    try {
      const keyBytes = hexToUint8Array(roomKey);

      const user = localStorage.getItem("username");
      if (!user) {
        console.error("Username not found in localStorage. Please login again.");
        return;
      }

      const user_iv = generateIv();
      const iv = generateIv();

      const [encryptedContent, encryptedUser] = await Promise.all([
        encrypt(content, keyBytes, hexToUint8Array(iv)),
        encrypt(user, keyBytes, hexToUint8Array(user_iv)),
      ]);

      const requestData = {
        user: encryptedUser.encrypted,
        user_iv,
        content: encryptedContent.encrypted,
        iv,
      };

      await axios.post(`${API_BASE}/api/messages/${roomId}`, requestData);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error("Axios error sending message:", error.response?.data ?? error.message);
      } else {
        console.error("Unexpected error sending message:", error);
      }
    }
  };

  return sendMessage;
};
