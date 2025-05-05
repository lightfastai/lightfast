import type { Message as VercelMessage } from "ai";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";

import { ToolExecutionCard } from "./tool-execution-card";

interface ChatMessageProps {
  message: VercelMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
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

  const toolParts = Array.isArray(message.parts)
    ? message.parts.filter((part) => part.type === "tool-invocation")
    : [];

  const hasParts = Array.isArray(message.parts) && message.parts.length > 0;
  const hasContent =
    !hasParts && message.content && message.content.trim().length > 0;
  const hasToolParts = toolParts.length > 0;
  const hasVisibleOutput = hasParts || hasContent || hasToolParts;

  useEffect(() => {
    if (!isUser && hasVisibleOutput && createdAt && duration === null) {
      const now = new Date();
      // const diffInSeconds = Math.round(
      //   (now.getTime() - createdAt.getTime()) / 1000,
      // );
      setDuration(Math.max(0, 1)); // Keep simple duration logic for now
    }
  }, [isUser, hasVisibleOutput, createdAt, duration]);

  return (
    <div className={cn("group relative mb-4 flex flex-col")}>
      <div className="flex items-center space-x-2 px-3 py-1">
        {isUser ? (
          <>
            <Avatar className="bg-background flex h-6 w-6 shrink-0 items-center justify-center rounded-md border shadow select-none">
              <AvatarImage src={`https://avatar.vercel.sh/${user.email}`} />
              <AvatarFallback>
                {user.email?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-grow text-sm font-normal break-words whitespace-pre-wrap">
              {hasParts
                ? message.parts
                    ?.filter((part) => part.type === "text")
                    .map((part, index) => <span key={index}>{part.text}</span>)
                : message.content}
            </div>
          </>
        ) : (
          <>
            <Avatar className="bg-background flex h-6 w-6 shrink-0 items-center justify-center rounded-md border shadow select-none">
              <AvatarImage src={`https://avatar.vercel.sh/${assistant.name}`} />
              <AvatarFallback>
                {assistant.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-xs">
              {duration !== null ? `Thought for ${duration}s` : "Thinking..."}
            </span>
          </>
        )}
      </div>

      {/* Render tool parts for both user and assistant messages */}
      {(isUser ? hasToolParts : hasParts || hasContent || hasToolParts) && (
        <div className={cn("pr-3", isUser ? "pl-10" : "pl-10")}>
          {!isUser && (
            <div className="text-sm font-normal break-words whitespace-pre-wrap">
              {hasParts
                ? message.parts
                    ?.filter((part) => part.type === "text")
                    .map((part, index) => <span key={index}>{part.text}</span>)
                : message.content}
            </div>
          )}
          {toolParts.map(renderMessagePart)}
        </div>
      )}
    </div>
  );
}
