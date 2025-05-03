import type { Message } from "ai";
import { useWorkspaceChat } from "@/hooks/use-workspace-chat";

import { ChatInput } from "./chat-input";
import { ChatWindow } from "./chat-window";

interface WorkspaceChatProps {
  workspaceId: string;
  sessionId: string | null;
  initialMessages: Message[];
}

export function WorkspaceChat({
  workspaceId,
  sessionId,
  initialMessages,
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
    <>
      <ChatWindow
        messages={messages}
        testResult={testResult}
        isLoading={isLoading}
        error={error}
        onDismissTestResult={handleDismissTestResult}
      />
      <ChatInput
        input={input}
        isLoading={isLoading}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
      />
    </>
  );
}
