import { useCallback, useEffect, useRef, useState } from "react";
import { SessionChatV1Message } from "@/types/internal";

// Flexible regex to match Python code blocks (with or without 'python' after the backticks)
const pythonCodeBlockRegex = /```(?:python)?\n([\s\S]*?)\n```/i;

interface UseBlenderCodeExecutorArgs {
  message: SessionChatV1Message | null | undefined;
}

// Export the type
export interface BlenderExecutionResult {
  success?: boolean;
  inProgress?: boolean;
  message: string;
}

export function useBlenderCodeExecutor({
  message,
}: UseBlenderCodeExecutorArgs) {
  const [executingCode, setExecutingCode] = useState<boolean>(false);
  const [executionResult, setExecutionResult] =
    useState<BlenderExecutionResult | null>(null);
  // Track the last executed message ID to avoid duplicate execution
  const lastExecutedMessageId = useRef<string | null>(null);
  // Track the timeout for auto-dismiss
  const autoDismissTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoDismissTimeout.current) {
        clearTimeout(autoDismissTimeout.current);
      }
    };
  }, []);

  const executeCode = useCallback(async (codeToExecute: string) => {
    setExecutingCode(true);
    setExecutionResult({
      inProgress: true,
      message: "Executing Blender code...",
    });
    console.log(
      "Executing Blender code:",
      codeToExecute.substring(0, 100) +
        (codeToExecute.length > 100 ? "..." : ""),
    );

    try {
      if (!window.blenderConnection) {
        throw new Error("Blender connection not available.");
      }
      if (codeToExecute.length > 50000) {
        // 50KB limit
        throw new Error("Code too large (>50KB)");
      }

      const result = await Promise.race([
        window.electronAPI.invoke("handle-blender-execute-code", {
          code: codeToExecute,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout executing code")), 30000),
        ),
      ]);

      console.log("Renderer: Blender execution result:", result);
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(`Blender error: ${result.error}`);
      }
      setExecutionResult({
        success: true,
        message: `Code executed successfully.`,
      });
    } catch (error: any) {
      console.error("Renderer: Error executing Blender code:", error);
      setExecutionResult({
        success: false,
        message: `Execution Error: ${error.message}`,
      });
    } finally {
      setExecutingCode(false);
      // Auto-dismiss result after 5 seconds
      if (autoDismissTimeout.current) {
        clearTimeout(autoDismissTimeout.current);
      }
      autoDismissTimeout.current = setTimeout(
        () => setExecutionResult(null),
        5000,
      );
    }
  }, []);

  useEffect(() => {
    // Only process if:
    // - message is from assistant
    // - not currently executing
    // - message is new (not already executed)
    if (
      !message ||
      message.role !== "assistant" ||
      executingCode ||
      !message.id ||
      lastExecutedMessageId.current === message.id
    ) {
      return;
    }

    // Check for a complete Python code block
    pythonCodeBlockRegex.lastIndex = 0;
    const match = pythonCodeBlockRegex.exec(message.content ?? "");
    const code = match && match[1]?.trim();

    if (code) {
      // Mark this message as executed
      lastExecutedMessageId.current = message.id;
      // Add a small delay to allow UI to update before showing 'Executing...'
      const timerId = setTimeout(() => {
        void executeCode(code);
      }, 100);
      // Cleanup if message changes quickly
      return () => clearTimeout(timerId);
    }
    // If no code block, do not update lastExecutedMessageId so future updates can still trigger
  }, [
    message?.id,
    message?.content,
    message?.role,
    executingCode,
    executeCode,
  ]);

  const handleDismissResult = useCallback(() => {
    setExecutionResult(null);
    // Optionally allow re-execution if message changes
    // lastExecutedMessageId.current = null;
  }, []);

  return {
    isExecuting: executingCode,
    executionResult,
    dismissExecutionResult: handleDismissResult,
  };
}
