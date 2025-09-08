import axios from "axios";
import { hexToUint8Array, generateIv, encrypt } from "../utils/crypto";

export const useSendMessage = (roomId: string, roomKey: string) => {
  const sendMessage = async (content: string) => {
    if (!content.trim()) {
      return;
    }

    try {
      const keyBytes = hexToUint8Array(roomKey);
      const user = localStorage.getItem("username");
      if (!user) {
        console.error(
          "Username not found in localStorage. Please login again."
        );
        // Here you might want to redirect to a login page or show an error message to the user.
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
        user_iv: user_iv,
        content: encryptedContent.encrypted,
        iv: iv,
      };

      await axios.post(`/api/messages/${roomId}`, requestData);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return sendMessage;
};
