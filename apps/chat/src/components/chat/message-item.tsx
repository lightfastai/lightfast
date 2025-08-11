"use client";

import type { ChatMessage } from "~/lib/types";

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageItem({ message, isStreaming }: MessageItemProps) {
  const isUser = message.role === "user";
  
  return (
    <div className={`p-4 rounded-lg ${isUser ? "bg-accent ml-auto max-w-[80%]" : "bg-muted max-w-[80%]"}`}>
      <div className="text-xs text-muted-foreground mb-1">
        {isUser ? "You" : "Assistant"}
      </div>
      <div className="prose prose-sm dark:prose-invert">
        {/* TODO: Render message content with markdown support */}
        {/* TODO: Handle streaming text if isStreaming */}
        {message.content}
      </div>
    </div>
  );
}