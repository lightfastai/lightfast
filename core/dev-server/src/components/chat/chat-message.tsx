"use client";

import { cn } from "../../lib/utils";
import type { Message } from "ai";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  
  return (
    <div className={cn("flex items-start gap-3", isUser ? "flex-row-reverse" : "")}>
      {/* Avatar */}
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        isUser ? "bg-primary" : "bg-primary/10"
      )}>
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>
      
      {/* Message */}
      <div className="flex-1 space-y-1">
        <div
          className={cn(
            "rounded-2xl px-4 py-3 max-w-[80%] break-words",
            isUser
              ? "bg-primary text-primary-foreground ml-auto rounded-tr-sm"
              : "bg-muted rounded-tl-sm"
          )}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  );
}