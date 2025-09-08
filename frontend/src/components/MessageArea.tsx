import { useEffect, useRef } from "react";
import type { Message } from "../App";
import MessageComponent from "./MessageComponent";

interface MessageAreaProps {
  className?: string;
  messages: Message[];
}

const formatTimestamp = (timestamp: string): string => {
  const dateObject = new Date(timestamp);
  const year = dateObject.getFullYear();
  const month = (dateObject.getMonth() + 1).toString().padStart(2, "0");
  const day = dateObject.getDate().toString().padStart(2, "0");
  const hours = dateObject.getHours().toString().padStart(2, "0");
  const minutes = dateObject.getMinutes().toString().padStart(2, "0");
  const seconds = dateObject.getSeconds().toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const MessageArea = ({ className, messages }: MessageAreaProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef<number>(messages.length);

  useEffect(() => {
    Notification.requestPermission();

    const hasNewMessage = messages.length > prevMessagesLength.current;
    const username = localStorage.getItem("username");

    if (containerRef.current && hasNewMessage) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }

    if (hasNewMessage && document.hidden && username) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.user !== username) {
        const showNotification = () => {
          new Notification(`New message from ${lastMessage.user}`, {
            body: lastMessage.content,
          });
        };

        if (Notification.permission === "granted") {
          showNotification();
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
              showNotification();
            }
          });
        }
      }
    }

    prevMessagesLength.current = messages.length;
  }, [messages]);

  return (
    <div ref={containerRef} className={className}>
      {messages.map((msg) => (
        <MessageComponent
          key={msg.id}
          username={msg.user}
          timestamp={formatTimestamp(msg.timestamp)}
          content={msg.content}
        />
      ))}
    </div>
  );
};

export default MessageArea;
