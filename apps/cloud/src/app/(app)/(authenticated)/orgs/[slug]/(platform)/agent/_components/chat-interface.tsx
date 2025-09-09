"use client";

import { useState } from "react";
import { useCloudChat } from "~/hooks/use-cloud-chat";
import { type CloudChatMessage } from "~/types/chat-messages";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "@repo/ui/components/chat";
import { cn } from "~/lib/utils";

interface ChatInterfaceProps {
  agentId: string;
  sessionId: string;
  initialMessages?: CloudChatMessage[];
  className?: string;
  onError?: (error: Error) => void;
}

export function ChatInterface({ 
  agentId, 
  sessionId, 
  initialMessages = [], 
  className,
  onError
}: ChatInterfaceProps) {
  const { messages, sendMessage, status, isLoading } = useCloudChat({
    agentId,
    sessionId,
    initialMessages,
    onError: (err) => {
      console.error("[ChatInterface] Error:", err);
      onError?.(err);
    },
  });

  const handleSendMessage = async (message: string) => {
    try {
      await sendMessage(message);
    } catch (err) {
      throw err; // Let ChatInput handle the error
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Messages */}
      <ChatMessages messages={messages} isLoading={isLoading} />

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        placeholder={`Chat with ${agentId}...`}
      />
    </div>
  );
}