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
      <MessageArea
        className="flex-1 p-6 overflow-y-auto w-full max-w-3xl mx-auto"
        messages={messages}
      />
      <ChatBox
        className="grid w-full max-w-3xl grid-cols-[1fr_2.5rem] items-center gap-2 p-2 mx-auto"
        roomId={roomId}
        roomKey={roomKey}
      />
    </>
  );
}
