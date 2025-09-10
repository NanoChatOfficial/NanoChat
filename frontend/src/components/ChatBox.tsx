import { useRef } from "react";
import { BiSolidSend } from "react-icons/bi";
import { useSendMessage } from "../hooks/useSendMessage";

interface ChatBoxProps {
  roomId: string;
  roomKey: string;
  className: string;
}

const ChatBox = ({ roomId, roomKey, className }: ChatBoxProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useSendMessage(roomId, roomKey);

  const handleSendMessage = async () => {
    const content = textareaRef.current?.value || "";
    if (content.trim()) {
      await sendMessage(content);
      if (textareaRef.current) textareaRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      className={`${className} flex items-center gap-3 p-3 bg-base-100`}
    >
      <textarea
        ref={textareaRef}
        className="w-full rounded-2xl border border-base-300 bg-base-200 px-4 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary resize-none transition"
        placeholder="Type your message..."
        rows={1}
        onKeyDown={handleKeyDown}
      ></textarea>

      <button
        className="flex items-center justify-center rounded-full bg-primary text-white h-11 w-11 transition hover:bg-primary/90 active:scale-95 shadow-md"
        onClick={handleSendMessage}
        title="Send Message"
      >
        <BiSolidSend size={20} />
      </button>
    </div>
  );
};

export default ChatBox;
