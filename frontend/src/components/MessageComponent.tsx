interface MessageComponentProps {
  username: string;
  timestamp: string;
  content: string;
}

const MessageComponent = ({
  username,
  timestamp,
  content,
}: MessageComponentProps) => {
  return (
    <>
      <div className="flex">
        <div className="relative w-10 h-10 overflow-hidden bg-gray-100 rounded-full dark:bg-gray-600">
          <svg
            className="absolute w-12 h-12 text-gray-400 -left-1"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            ></path>
          </svg>
        </div>
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
    </>
  );
};

export default MessageComponent;
