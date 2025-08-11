"use client";

interface ThreadListProps {
  userId: string;
  currentChatId?: string;
}

export function ThreadList({ userId, currentChatId }: ThreadListProps) {
  // TODO: List of chat threads
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Thread items */}
    </div>
  );
}