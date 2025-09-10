interface NavBarProps {
  roomId: string;
  onRoomNuked?: () => void;
}

const NavBar = ({ roomId, onRoomNuked }: NavBarProps) => {
  const handleNukeRoom = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to nuke this room? This will delete all messages and block new ones."
    );
    if (!confirmed) return;

    try {
      const url = `${window.location.protocol}//${window.location.hostname}:8000/api/room/${roomId}/nuke/`;

      const response = await fetch(url, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Status ${response.status}`);
      }

      alert("Room nuked!");
      if (onRoomNuked) onRoomNuked();
    } catch (error) {
      console.error("Failed to nuke room:", error);
      alert("Failed to nuke room.");
    }
  };

  return (
    <div className="navbar flex bg-base-100 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <a className="btn btn-ghost text-xl">NanoChat</a>
        <span
          className="text-error font-medium cursor-pointer hover:underline"
          onClick={handleNukeRoom}
          title="Nuke chatroom"
        >
          Nuke chatroom
        </span>
      </div>

      <a
        className="mr-4 normal-case text-sm"
        href="https://github.com/NanoChatOfficial/NanoChat"
        target="_blank"
        rel="noopener noreferrer"
      >
        Source
      </a>
    </div>
  );
};

export default NavBar;
