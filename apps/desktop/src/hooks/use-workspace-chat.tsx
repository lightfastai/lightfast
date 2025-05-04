import type { Message } from "ai";
import { useState } from "react";
import { useChat } from "@ai-sdk/react";

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

  // Get the base chat functionality from useChat
  const {
    messages,
    input,
    handleInputChange: baseHandleInputChange,
    handleSubmit,
    isLoading,
    status,
    error,
  } = useChat({
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

      // Handle executeBlenderCode tool
      if (toolCall.toolName === "executeBlenderCode") {
        try {
          // Check if we have a connection to Blender
          if (!window.blenderConnection) {
            throw new Error(
              "Blender connection not available. Make sure Blender is running with the Lightfast addon enabled.",
            );
          }

          // Get the code to execute
          const { code } = toolCall.args;
          if (!code || typeof code !== "string") {
            throw new Error("No code provided or invalid code format");
          }

          // Add safety checks for code
          if (code.length > 50000) {
            throw new Error("Code too large to execute safely (>50KB)");
          }

          console.log(
            "Executing Blender code:",
            code.substring(0, 100) + (code.length > 100 ? "..." : ""),
          );

          // Execute the code in Blender with a timeout
          const result = await Promise.race([
            window.electronAPI.invoke("handle-blender-execute-code", {
              code,
            }),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Timeout executing code in Blender")),
                30000,
              ),
            ),
          ]);

          console.log("Renderer: Blender code execution result:", result);

          // Check for errors in the result
          if (result && typeof result === "object" && "error" in result) {
            throw new Error(`Blender execution error: ${result.error}`);
          }

          // Set a temporary test result to show feedback in the UI
          setTestResult({
            success: true,
            message: "Code executed in Blender successfully",
          });

          // Clear the test result after 3 seconds
          setTimeout(() => {
            setTestResult(null);
          }, 3000);

          // Return success message with more details
          return JSON.stringify({
            success: true,
            message: "Code execution completed in Blender",
            details:
              result && typeof result === "object"
                ? result
                : { output: "No output" },
            code: code.substring(0, 100) + (code.length > 100 ? "..." : ""), // Include truncated code for reference
          });
        } catch (error: any) {
          console.error("Renderer: Error executing code in Blender:", error);

          // Set a temporary test result to show feedback in the UI
          setTestResult({
            success: false,
            message: `Error: ${error.message}`,
          });

          // Clear the test result after 5 seconds
          setTimeout(() => {
            setTestResult(null);
          }, 5000);

          // Return detailed error information
          return JSON.stringify({
            success: false,
            error: `Blender Code Execution Error: ${error.message}`,
            details: error.stack ? error.stack : "No stack trace available",
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

  // Create a custom handleInputChange that works with both HTMLInputElement and HTMLTextAreaElement
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    baseHandleInputChange(e as React.ChangeEvent<HTMLInputElement>);
  };

  const handleDismissTestResult = () => {
    setTestResult(null);
  };

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    status,
    error,
    testResult,
    setTestResult,
    handleDismissTestResult,
  };
}
