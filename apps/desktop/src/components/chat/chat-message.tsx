import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";

import { ToolExecutionCard } from "./tool-execution-card";

interface ChatMessageProps {
  message: UIMessage;
  status?: "submitted" | "streaming" | "ready" | "error";
}

export function ChatMessage({ message, status = "ready" }: ChatMessageProps) {
  const [duration, setDuration] = useState<number | null>(null);

  const renderMessagePart = (part: any, partIndex: number) => {
    if (part.type === "text") {
      return part.text;
    }

    if (part.type === "tool-invocation") {
      const toolInvocation = part.toolInvocation || part;
      const toolCallId = toolInvocation.toolCallId;
      const toolName = toolInvocation.toolName;
      const state = toolInvocation.state;
      const args = toolInvocation.args || {};
      const result = toolInvocation.result;
      const error = toolInvocation.error;

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
    return null;
  };

  const user = {
    email: "test@test.com", // TODO: Replace with actual user data
  };
  const assistant = {
    name: "Assistant", // Placeholder for assistant identity if needed
  };

  const isUser = message.role === "user";
  const createdAt = message.createdAt;

  // Handle streaming message parts properly
  const textParts = Array.isArray(message.parts)
    ? message.parts.filter((part) => part.type === "text")
    : [];

  const toolParts = Array.isArray(message.parts)
    ? message.parts.filter((part) => part.type === "tool-invocation")
    : [];

  const hasParts = Array.isArray(message.parts) && message.parts.length > 0;
  const hasContent =
    !hasParts && message.content && message.content.trim().length > 0;
  const hasToolParts = toolParts.length > 0;
  const hasVisibleOutput = hasParts || hasContent || hasToolParts;

  // More robust text content detection
  const hasTextContent =
    // Check for text in parts
    (Array.isArray(message.parts) &&
      message.parts.some(
        (part) =>
          part.type === "text" &&
          typeof part.text === "string" &&
          part.text.trim().length > 0,
      )) ||
    // Check for text in content
    (typeof message.content === "string" && message.content.trim().length > 0);

  // Render text content properly handling both content string and text parts
  const renderTextContent = () => {
    if (hasParts && textParts.length > 0) {
      return textParts.map((part, index) => (
        <span key={`text-${index}`}>{part.text}</span>
      ));
    }
    return message.content;
  };

  useEffect(() => {
    if (!isUser && hasVisibleOutput && createdAt && duration === null) {
      // const diffInSeconds = Math.round(
      //   (new Date().getTime() - createdAt.getTime()) / 1000,
      // );
      setDuration(Math.max(0, 0));
    }
  }, [isUser, hasVisibleOutput, createdAt, duration]);

  return (
    <div className={cn("group relative mb-4 flex flex-col")}>
      {/* User message */}
      {isUser ? (
        <div className="flex items-center space-x-2 px-3 py-1">
          <Avatar className="bg-background flex h-6 w-6 shrink-0 items-center justify-center rounded-md border shadow select-none">
            <AvatarImage src={`https://avatar.vercel.sh/${user.email}`} />
            <AvatarFallback>
              {user.email?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-grow text-sm font-normal break-words whitespace-pre-wrap">
            {renderTextContent()}
          </div>
        </div>
      ) : (
        /* Assistant message */
        <>
          <div className="flex items-center space-x-2 px-3 py-1">
            <Avatar className="bg-background flex h-6 w-6 shrink-0 items-center justify-center rounded-md border shadow select-none">
              <AvatarImage src={`https://avatar.vercel.sh/${assistant.name}`} />
              <AvatarFallback>
                {assistant.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {/* Thinking state or thought duration */}
            {status === "submitted" ? (
              <span className="text-muted-foreground flex items-center gap-2 text-xs">
                Thinking .....
              </span>
            ) : hasTextContent && duration !== null ? (
              <span className="text-muted-foreground text-xs">
                Thought for {duration} seconds
              </span>
            ) : null}
          </div>

          {/* Only render content if we have text or tool parts */}
          {(hasTextContent || hasToolParts) && (
            <div className="pr-3 pl-10">
              <div className="text-sm font-normal break-words whitespace-pre-wrap">
                {renderTextContent()}
              </div>
              {toolParts.map(renderMessagePart)}
            </div>
          )}
        </>
      )}

      {/* Render tool parts for user messages */}
      {isUser && hasToolParts && (
        <div className="pr-3 pl-10">{toolParts.map(renderMessagePart)}</div>
      )}
    </div>
  );
}
