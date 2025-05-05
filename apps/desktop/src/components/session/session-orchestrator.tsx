import { useSessionChatV1 } from "@/hooks/use-session-chat";
import { cn } from "@/lib/utils";
import { DBMessage } from "@/types/internal";

import { ChatInput } from "../chat/chat-input";
import { ChatWindow } from "../chat/chat-window";

interface WorkspaceChatProps {
  workspaceId: string;
  sessionId: string | null;
  initialMessages?: DBMessage[];
  className?: string;
  autoResume?: boolean;
}

export function SessionOrchestrator({
  workspaceId,
  sessionId,
  initialMessages,
  className,
  autoResume = false,
}: WorkspaceChatProps) {
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    status,
    error,
    addToolResult,
  } = useSessionChatV1({
    workspaceId,
    sessionId,
    initialMessages,
    autoResume,
  });

  return (
    <div className={cn("bg-background flex h-full w-full flex-col", className)}>
      <div className="flex h-full w-full flex-col items-center overflow-hidden">
        <div className="w-full max-w-3xl flex-1 overflow-hidden">
          <ChatWindow
            messages={messages}
            status={status}
            error={error || null}
            className="w-full"
            addToolResult={addToolResult}
          />
        </div>
        <div className="w-full max-w-3xl px-4 pb-4">
          <ChatInput
            input={input}
            status={status}
            setInput={setInput}
            handleSubmit={handleSubmit}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
