
import MessageArea from "./MessageArea";
import ChatBox from "./ChatBox";
import { useMessages } from "../hooks/useMessages";
import { useAuth } from "../hooks/useAuth";

interface RoomProps {
  roomId: string;
  roomKey: string;
}

export default function Room({ roomId, roomKey }: RoomProps) {
  useAuth();
  const messages = useMessages(roomId, roomKey);

  return (
    <>
      <MessageArea className="flex-1 p-6 overflow-y-auto" messages={messages} />
      <ChatBox roomId={roomId} />
    </>
  );
}
