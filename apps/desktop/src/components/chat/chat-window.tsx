import type { BlenderExecutionResult } from "@/hooks/use-blender-code-executor";
import type { UIMessage } from "ai";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { cn } from "@/lib/utils";
import { Terminal } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

import { ChatMessage } from "./chat-message";

interface ChatWindowProps {
  messages: UIMessage[];
  status?: "submitted" | "streaming" | "ready" | "error";
  error?: Error | null;
  testResult: BlenderExecutionResult | null;
  onDismissTestResult: () => void;
  className?: string;
  addToolResult?: (args: { toolCallId: string; result: any }) => void;
}

export function ChatWindow({
  messages,
  status,
  error,
  testResult,
  onDismissTestResult,
  className,
  addToolResult,
}: ChatWindowProps) {
  const { containerRef } = useScrollToBottom();

  const isStreamingOrSubmitted =
    status === "streaming" || status === "submitted";

  return (
    <div className={cn("flex h-full flex-col overflow-y-auto p-4", className)}>
      <ScrollArea className="h-full" ref={containerRef}>
        <div className="flex-1 space-y-4">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id ?? `message-${index}`}
              message={message}
              status={status}
              addToolResult={addToolResult}
            />
          ))}
          {isStreamingOrSubmitted &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <ChatMessage
                key="assistant-thinking"
                message={{
                  id: "assistant-thinking",
                  role: "assistant",
                  content: "",
                  parts: [],
                }}
                status={status}
              />
            )}
          <div ref={containerRef} />
        </div>

        {error && (
          <Alert variant="destructive" className="my-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {testResult && (
          <Alert
            variant={testResult.success ? "default" : "destructive"}
            className="my-4"
          >
            <AlertTitle>
              {testResult.inProgress
                ? "Executing Blender code..."
                : testResult.success
                  ? "Success"
                  : "Error"}
            </AlertTitle>
            <AlertDescription>{testResult.message}</AlertDescription>
            <button
              className="ml-2 text-xs underline"
              onClick={onDismissTestResult}
            >
              Dismiss
            </button>
          </Alert>
        )}
      </ScrollArea>
    </div>
  );
}
