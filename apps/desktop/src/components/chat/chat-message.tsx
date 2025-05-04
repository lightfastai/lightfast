import type { Message } from "ai";
import { cn } from "@/lib/utils";

import { ToolExecutionCard } from "./tool-execution-card";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  // Helper function to render message parts
  const renderMessagePart = (part: any, partIndex: number) => {
    if (part.type === "text") {
      return part.text;
    }

    if (part.type === "tool-invocation") {
      // The data structure varies between different versions of the AI SDK
      // Try to extract the tool information regardless of the structure

      // First, find the toolInvocation object, which could be directly in the part
      // or nested in a 'toolInvocation' property
      const toolInvocation = part.toolInvocation || part;

      // Extract properties from the toolInvocation
      const toolCallId = toolInvocation.toolCallId;
      const toolName = toolInvocation.toolName;
      const state = toolInvocation.state;

      // Args could be directly in toolInvocation or in a nested structure
      const args = toolInvocation.args || {};

      const result = toolInvocation.result;
      const error = toolInvocation.error;

      // Use the new ToolExecutionCard component for better UX
      return (
        <ToolExecutionCard
          key={`${message.id}-${toolCallId}-${partIndex}`}
          toolName={toolName}
          toolState={state}
          args={args}
          result={result}
          error={error}
          messageId={message.id || "message"}
          toolCallId={toolCallId || `tool-${partIndex}`}
        />
      );
    }

    // Handle other part types if they exist
    return null;
  };

  // Determine if this is a user or assistant message
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "group relative mb-4 flex items-start",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {/* Avatar/icon for the message sender */}
      {!isUser && (
        <div className="bg-background mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border shadow select-none">
          <span className="text-muted-foreground text-xs font-semibold">
            AI
          </span>
        </div>
      )}

      {/* Message content */}
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-2 rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {Array.isArray(message.parts) ? (
          <>
            {/* Text content (if any) */}
            {message.parts.some((part) => part.type === "text") && (
              <div className="break-words whitespace-pre-wrap">
                {message.parts
                  .filter((part) => part.type === "text")
                  .map((part: any, idx) => (
                    <span key={idx}>{part.text}</span>
                  ))}
              </div>
            )}

            {/* Tool invocation parts */}
            {message.parts
              .filter((part) => part.type === "tool-invocation")
              .map((part: any, idx) => renderMessagePart(part, idx))}
          </>
        ) : (
          <div className="break-words whitespace-pre-wrap">
            {message.content}
          </div>
        )}
      </div>

      {/* Avatar/icon for user */}
      {isUser && (
        <div className="bg-background ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border shadow select-none">
          <span className="text-muted-foreground text-xs font-semibold">
            You
          </span>
        </div>
      )}
    </div>
  );
}
