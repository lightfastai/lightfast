import { DBMessage } from "@/types/internal";

import { cn } from "@repo/ui/lib/utils";

import { useSessionStreamableAgent } from "./hooks/use-session-streamable-agent";
import { SessionView } from "./session-chat-view";
import { SessionInput } from "./session-input-view";

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
  } = useSessionStreamableAgent({
    workspaceId,
    sessionId,
    initialMessages,
    autoResume,
  });

  return (
    <div className={cn("bg-background flex h-full w-full flex-col")}>
      <div className="flex h-full w-full flex-col items-center overflow-hidden">
        <div className="w-full max-w-3xl flex-1 overflow-hidden">
          <SessionView
            messages={messages}
            status={status}
            error={error || null}
            className="w-full"
            addToolResult={addToolResult}
          />
        </div>
        <div className="w-full max-w-3xl px-4 pb-4">
          <SessionInput
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
