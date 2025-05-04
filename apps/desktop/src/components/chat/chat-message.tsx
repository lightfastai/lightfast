import type { Message } from "ai";
import { cn } from "@/lib/utils";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";

import { ToolExecutionCard } from "./tool-execution-card";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  // Helper function to render message parts (primarily for assistant body)
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

  // Extract text content for user header or assistant body
  const textContent = Array.isArray(message.parts)
    ? message.parts
        .filter((part) => part.type === "text")
        .map((part: any) => part.text)
        .join("")
    : message.content;

  // Filter tool invocation parts for assistant body
  const toolParts = Array.isArray(message.parts)
    ? message.parts.filter((part) => part.type === "tool-invocation")
    : [];

  return (
    <div className={cn("group relative mb-4 flex flex-col")}>
      {/* Message Header */}
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
              {/* Placeholder for Assistant Avatar if different */}
              <AvatarImage src={`https://avatar.vercel.sh/${assistant.name}`} />
              <AvatarFallback>
                {assistant.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-xs">
              {/* Placeholder for "thought for x seconds" */}
              Thinking...
            </span>
          </>
        )}
      </div>

      {/* Message Body */}
      <div className="px-3 py-2">
        {isUser ? (
          <>
            {/* Body content for user messages (e.g., images) can go here */}
            {/* For now, it's empty as per the request */}
          </>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            {/* Assistant Body Content */}
            {textContent && (
              <div className="break-words whitespace-pre-wrap">
                {textContent}
              </div>
            )}
            {/* Render Tool Parts */}
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
