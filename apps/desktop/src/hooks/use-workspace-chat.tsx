import type { Message } from "ai";
import { useState } from "react";
import { useChat } from "ai/react";

interface UseWorkspaceChatProps {
  workspaceId: string;
  sessionId: string | null;
  initialMessages?: Message[];
}

export function useWorkspaceChat({
  workspaceId,
  sessionId,
  initialMessages = [],
}: UseWorkspaceChatProps) {
  // Local state for test operation results
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: `${import.meta.env.VITE_PUBLIC_LIGHTFAST_API_URL}/api/chat`,
      id: sessionId || undefined,
      initialMessages,
      body: {
        sessionId,
        workspaceId,
      },
      // Implement client-side tool execution via onToolCall
      async onToolCall({
        toolCall,
      }: {
        toolCall: { toolName: string; args: any };
      }) {
        console.log("Client onToolCall received:", toolCall);

        if (toolCall.toolName === "createBlenderObject") {
          try {
            // Invoke the main process handler via IPC
            const result = await window.electronAPI.invoke(
              "handle-blender-create-object",
              toolCall.args,
            );
            console.log(
              "Renderer: Received result from main for tool call:",
              result,
            );
            // Return the result (must be serializable, string is safest)
            return JSON.stringify(result);
          } catch (error: any) {
            console.error(
              "Renderer: Error executing createBlenderObject via IPC:",
              error,
            );
            // Return error information (as a string)
            return JSON.stringify({
              success: false,
              error: `IPC Error: ${error.message}`,
            });
          }
        }

        // Handle other potential client-side tools here if needed

        console.warn(`Tool '${toolCall.toolName}' not handled on client.`);
        return JSON.stringify({
          success: false,
          error: `Tool '${toolCall.toolName}' not implemented on client.`,
        });
      },
    });

  if (error) {
    console.error("Chat Error:", error);
  }

  const handleDismissTestResult = () => {
    setTestResult(null);
  };

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    testResult,
    setTestResult,
    handleDismissTestResult,
  };
}
