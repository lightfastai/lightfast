"use client";

import type { ChatMessage } from "~/lib/types";
import { MessageItem } from "./message-item";

interface ChatMessagesProps {
  threadId?: string;
  messages?: ChatMessage[];
  isLoading?: boolean;
}

export function ChatMessages({ threadId, messages = [], isLoading }: ChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          {/* TODO: Add empty state */}
          Start your conversation...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-3xl mx-auto">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          // TODO: Pass additional props
        />
      ))}
      {isLoading && (
        <div className="bg-muted p-4 rounded-lg">
          <div className="animate-pulse">Thinking...</div>
        </div>
      )}
    </div>
  );
}