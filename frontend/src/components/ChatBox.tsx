import { useRef } from "react";
import axios from "axios";
import { hexToUint8Array, generateIv, encrypt } from "../utils/crypto";
import { BiSolidSend } from "react-icons/bi";

const ChatBox = ({ roomId }: { roomId: string }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function sendMessage() {
    const keyBytes = hexToUint8Array(window.location.hash.slice(1));
    const user = localStorage.getItem("username");
    const user_iv = generateIv();
    const iv = generateIv();
    const content = textareaRef.current?.value || "";

    if (!content.trim()) return; // Don't send empty messages

    const [encryptedContent, encryptedUser] = await Promise.all([
      encrypt(content, keyBytes, hexToUint8Array(iv)),
      encrypt(user!, keyBytes, hexToUint8Array(user_iv)),
    ]);

    const requestData = {
      user: encryptedUser.encrypted,
      user_iv: user_iv,
      content: encryptedContent.encrypted,
      iv: iv,
    };

    axios
      .post("/api/messages/" + roomId, requestData)
      .then((response) => {
        console.log(response.data);
      })
      .catch((error) => {
        console.error("Error sending message:", error);
      });

    textareaRef.current!.value = "";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Shift+Enter will insert a newline by default
  }

  return (
    <div className="grid grid-cols-[1fr_2.5rem] items-center gap-2 p-2">
      <textarea
        ref={textareaRef}
        className="textarea textarea-ghost focus:outline-none resize-none w-full"
        placeholder="Send a message..."
        onKeyDown={handleKeyDown}
      ></textarea>
      <button
        className="bg-primary cursor-pointer flex items-center justify-center rounded-full h-10 w-10"
        onClick={sendMessage}
      >
        <BiSolidSend size={16} />
      </button>
    </div>
  );
};

export default ChatBox;
