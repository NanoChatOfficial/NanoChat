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
      if (textareaRef.current) {
        textareaRef.current.value = "";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={className}>
      <textarea
        ref={textareaRef}
        className="textarea textarea-ghost focus:outline-none resize-none w-full"
        placeholder="Send a message..."
        onKeyDown={handleKeyDown}
      ></textarea>
      <button
        className="bg-blue-400 cursor-pointer flex items-center justify-center rounded-full h-10 w-10"
        onClick={handleSendMessage}
      >
        <BiSolidSend size={16} />
      </button>
    </div>
  );
};

export default ChatBox;
