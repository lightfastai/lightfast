import { Suspense } from "react";

interface ChatLayoutProps {
  children: React.ReactNode;
}

// Main layout component - server component with PPR (without sidebar)
export function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <div className="flex h-screen w-full">
      <div className="flex flex-col w-full">
        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}