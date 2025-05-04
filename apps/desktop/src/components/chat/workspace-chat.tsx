import type { Message } from "ai";
import { useWorkspaceChat } from "@/hooks/use-workspace-chat";
import { cn } from "@/lib/utils";

import { ChatInput } from "./chat-input";
import { ChatWindow } from "./chat-window";

interface WorkspaceChatProps {
  workspaceId: string;
  sessionId: string | null;
  initialMessages: Message[];
  className?: string;
}

export function WorkspaceChat({
  workspaceId,
  sessionId,
  initialMessages,
  className,
}: WorkspaceChatProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    testResult,
    handleDismissTestResult,
  } = useWorkspaceChat({
    workspaceId,
    sessionId,
    initialMessages,
  });

  return (
    <div
      className={cn("flex h-full w-full flex-col overflow-hidden", className)}
    >
      <div className="flex-1 overflow-hidden">
        <ChatWindow
          messages={messages}
          testResult={testResult}
          isLoading={isLoading}
          error={error}
          onDismissTestResult={handleDismissTestResult}
        />
      </div>
      <div className="border-t px-4 py-3">
        <ChatInput
          input={input}
          isLoading={isLoading}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
