import { useWorkspaceChat } from "@/hooks/use-workspace-chat";
import { cn } from "@/lib/utils";

import { RouterOutputs } from "@vendor/trpc";

import { ChatInput } from "./chat-input";
import { ChatWindow } from "./chat-window";

interface WorkspaceChatProps {
  workspaceId: string;
  sessionId: string | null;
  initialMessages: RouterOutputs["tenant"]["session"]["get"]["messages"];
  className?: string;
  autoResume?: boolean;
}

export function WorkspaceChat({
  workspaceId,
  sessionId,
  initialMessages,
  className,
  autoResume = false,
}: WorkspaceChatProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    error,
    testResult,
    handleDismissTestResult,
  } = useWorkspaceChat({
    workspaceId,
    sessionId,
    initialMessages,
    autoResume,
  });

  return (
    <div
      className={cn("flex h-full w-full flex-col overflow-hidden", className)}
    >
      <div className="flex-1 overflow-hidden">
        <ChatWindow
          messages={messages}
          testResult={testResult}
          status={status}
          error={error}
          onDismissTestResult={handleDismissTestResult}
        />
      </div>
      <div className="border-t px-4 py-3">
        <ChatInput
          input={input}
          isLoading={status === "submitted" || status === "streaming"}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
