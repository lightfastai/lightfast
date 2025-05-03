import type { Message } from "ai";

import { ToolExecutionCard } from "./tool-execution-card";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  // Log the message object to better understand its structure
  console.log("Message object:", JSON.stringify(message, null, 2));

  // Helper function to render message parts
  const renderMessagePart = (part: any, partIndex: number) => {
    // Log each part to understand its structure
    console.log("Part:", partIndex, JSON.stringify(part, null, 2));

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
      // For example in { "args": { "code": "..." } } or { "toolInvocation": { "args": { "code": "..." } } }
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

  return (
    <div>
      {Array.isArray(message.parts) && (
        <div>
          {/* Text content (if any) */}
          {message.parts.some((part) => part.type === "text") && (
            <div
              className={`mb-2 flex w-full ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  message.role === "user"
                    ? "text-primary-foreground bg-orange-500"
                    : "bg-muted text-foreground"
                }`}
              >
                {/* Combine all text parts */}
                {message.parts
                  .filter((part) => part.type === "text")
                  .map((part: any, idx) => (
                    <span key={idx}>{part.text}</span>
                  ))}
              </div>
            </div>
          )}

          {/* Tool invocation parts */}
          {message.parts
            .filter((part) => part.type === "tool-invocation")
            .map((part: any, idx) => renderMessagePart(part, idx))}
        </div>
      )}
    </div>
  );
}
