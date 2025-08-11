interface ChatSidebarProps {
  userId: string;
  currentChatId?: string;
}

export function ChatSidebar({ userId, currentChatId }: ChatSidebarProps) {
  // TODO: Sidebar with thread list
  return (
    <div className="w-64 border-r">
      {/* Thread list */}
    </div>
  );
}