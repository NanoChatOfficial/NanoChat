interface MessageComponentProps {
  username: string;
  timestamp: string;
  content: string;
}

const colors = [
  "bg-red-500",
  "bg-green-500",
  "bg-blue-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
];

const getColorForUser = (username: string) => {
  const index = username.charCodeAt(0) % colors.length;
  return colors[index];
};

const MessageComponent = ({ username, timestamp, content }: MessageComponentProps) => {
  const avatarColor = getColorForUser(username);
  const firstLetter = username.charAt(0).toUpperCase();

  return (
    <div className="flex">
      {/* Avatar with first letter */}
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full text-white font-bold ${avatarColor}`}
      >
        {firstLetter}
      </div>

      {/* Message content */}
      <div className="ml-3 flex-1">
        <div className="flex gap-2">
          <p className="font-bold">{username}</p>
        </div>
        <p className="italic text-xs">{timestamp}</p>
        <div className="mt-2 mb-4">
          <p>{content}</p>
        </div>
      </div>
    </div>
  );
};

export default MessageComponent;
