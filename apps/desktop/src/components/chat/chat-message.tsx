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

  const textContent = Array.isArray(message.parts)
    ? message.parts
        .filter((part) => part.type === "text")
        .map((part: any) => part.text)
        .join("")
    : message.content;

  const toolParts = Array.isArray(message.parts)
    ? message.parts.filter((part) => part.type === "tool-invocation")
    : [];

  const hasContent = textContent.trim().length > 0 || toolParts.length > 0;

  useEffect(() => {
    if (!isUser && hasContent && createdAt && duration === null) {
      const now = new Date();
      console.log(now, message.createdAt);
      // const diffInSeconds = Math.round(
      //   (now.getTime() - createdAt.getTime()) / 1000,
      // );
      setDuration(Math.max(0, 1));
    }
  }, [isUser, hasContent, createdAt, duration]);

  return (
    <div className={cn("group relative mb-4 flex flex-col")}>
      <div className="flex items-center space-x-2 px-3 py-1">
        {isUser ? (
          <>
            <Avatar className="bg-background flex h-5 w-5 shrink-0 items-center justify-center rounded-md border shadow select-none">
              <AvatarImage src={`https://avatar.vercel.sh/${user.email}`} />
              <AvatarFallback>
                {user.email?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-grow text-sm font-medium break-words whitespace-pre-wrap">
              {textContent}
            </div>
          </>
        ) : (
          <>
            <Avatar className="bg-background flex h-5 w-5 shrink-0 items-center justify-center rounded-md border shadow select-none">
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

      <div className="px-3 py-2">
        {isUser ? (
          <></>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            {textContent && (
              <div className="break-words whitespace-pre-wrap">
                {textContent}
              </div>
            )}
            {toolParts.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {toolParts.map((part, idx) => renderMessagePart(part, idx))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
