import { useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";

import { nanoid } from "@repo/lib";
import { RouterOutputs } from "@vendor/trpc";

// Import the new hook
import { useBlenderCodeExecutor } from "./use-blender-code-executor";

interface UseWorkspaceChatProps {
  workspaceId: string;
  sessionId: string | null;
  initialMessages?: RouterOutputs["tenant"]["session"]["get"]["messages"];
  autoResume?: boolean;
}

export function useWorkspaceChat({
  workspaceId,
  sessionId,
  initialMessages = [],
  autoResume = false,
}: UseWorkspaceChatProps) {
  // Get the base chat functionality from useChat
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    status,
    error,
    experimental_resume,
    append,
  } = useChat({
    api: `${import.meta.env.VITE_PUBLIC_LIGHTFAST_API_URL}/api/chat`,
    // @ts-expect-error todo fix conversion
    initialMessages,
    generateId: () => nanoid(),
    sendExtraMessageFields: true,
    experimental_streamMode: "words",
    experimental_prepareRequestBody: (body) => ({
      message: body.messages.at(-1),
      workspaceId,
      sessionId,
    }),
    onError: (err) => {
      console.error("Chat Error:", err);
      // Resetting execution state is now handled within useBlenderCodeExecutor
    },
    // onFinish is no longer needed here to trigger execution,
    // as the new hook uses useEffect based on the latest message.
    // async onFinish(message: Message) { ... },
  });

  // Find the latest assistant message to pass to the executor hook
  const latestAssistantMessage = useMemo(() => {
    // Iterate backwards to find the most recent assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return messages[i];
      }
    }
    return null; // No assistant message found
  }, [messages]);

  // Use the new hook, passing the latest assistant message
  const { isExecuting, executionResult, dismissExecutionResult } =
    useBlenderCodeExecutor({ message: latestAssistantMessage });

  // Effect to potentially resume stream
  useEffect(() => {
    if (autoResume && sessionId && experimental_resume) {
      console.log(`Attempting to resume chat for session: ${sessionId}`);
      experimental_resume();
    }
  }, [autoResume, sessionId, experimental_resume]);

  if (error) {
    console.error("Chat Error:", error);
  }

  return {
    messages,
    input,
    setInput,
    handleSubmit,
    status, // Overall chat status
    error, // Chat error
    // Use the state returned from the new hook
    testResult: executionResult,
    handleDismissTestResult: dismissExecutionResult,
    executingCode: isExecuting,
    experimental_resume,
    append,
  };
}
