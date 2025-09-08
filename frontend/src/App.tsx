import "./App.css";
import NavBar from "./components/NavBar";
import Room from "./components/Room";
import { useRoomManager } from "./hooks/useRoomManager";

export interface Message {
  id: string;
  user: string;
  content: string;
  timestamp: string;
}

function App() {
  const { roomId, key } = useRoomManager();

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      {roomId && key && <Room roomId={roomId} roomKey={key} />}
    </div>
  );
}

export default App;