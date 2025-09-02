"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

interface ChatInterfaceProps {
  agentId: string;
  agentName?: string;
}

export function ChatInterface({ agentId, agentName }: ChatInterfaceProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Generate a stable session ID for this chat session
  const sessionId = useRef(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).current;
  
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
  } = useChat({
    api: "/api/stream",
    body: {
      agentId,
      sessionId,
    },
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">
          Chat with {agentName || agentId}
        </h2>
        <p className="text-sm text-muted-foreground">
          Session: {sessionId}
        </p>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-6">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-lg mb-2">👋 Welcome!</p>
              <p className="text-sm">
                Start a conversation with {agentName || "the agent"}
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2">
                  <div className="animate-pulse">●</div>
                  <div className="animate-pulse animation-delay-200">●</div>
                  <div className="animate-pulse animation-delay-400">●</div>
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-2">
              <p className="text-sm">Error: {error.message}</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit}>
          <ChatInput
            value={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            disabled={isLoading}
            placeholder={`Message ${agentName || "agent"}...`}
          />
        </form>
      </div>
    </div>
  );
}