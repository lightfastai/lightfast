interface ThreadItemProps {
  thread: {
    id: string;
    title: string;
    createdAt: Date;
  };
  isActive?: boolean;
}

export function ThreadItem({ thread, isActive }: ThreadItemProps) {
  // TODO: Individual thread item in sidebar
  return (
    <div className="p-2 hover:bg-accent">
      {/* Thread info */}
    </div>
  );
}