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
  // --- Debugging Logs ---
  console.log("WorkspaceChat: Checking props for useWorkspaceChat");
  console.log("WorkspaceChat: workspaceId =", workspaceId);
  console.log("WorkspaceChat: sessionId =", sessionId);
  console.log("WorkspaceChat: initialMessages (prop) =", initialMessages);
  console.log(
    "WorkspaceChat: Number of initial messages =",
    initialMessages?.length ?? "N/A",
  );
  console.log("WorkspaceChat: autoResume =", autoResume);
  // --- End Debugging Logs ---

  const {
    messages,
    input,
    setInput,
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

  // Log the messages array *after* the hook is called
  console.log("WorkspaceChat: Messages from useChat hook =", messages);

  return (
    <div className={cn("bg-background flex h-full w-full flex-col", className)}>
      <div className="flex h-full w-full flex-col items-center overflow-hidden">
        <div className="w-full max-w-xl flex-1 overflow-hidden">
          <ChatWindow
            messages={messages}
            testResult={testResult}
            status={status}
            error={error || null}
            onDismissTestResult={handleDismissTestResult}
            className="w-full"
          />
        </div>
        <div className="w-full max-w-xl px-4 pb-4">
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
