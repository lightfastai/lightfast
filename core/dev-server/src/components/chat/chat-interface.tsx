"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { Bot, Sparkles } from "lucide-react";

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
    setInput,
    append,
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

  // Handle sending message using append
  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;
    
    // Use append to add the message
    await append({
      id: crypto.randomUUID(),
      role: "user",
      content: message,
    });
  }, [append, isLoading]);

  // Handle input change for controlled component
  const handleInputValueChange = useCallback((value: string) => {
    // Create a synthetic event for handleInputChange
    const syntheticEvent = {
      target: { value }
    } as React.ChangeEvent<HTMLTextAreaElement>;
    
    handleInputChange(syntheticEvent);
  }, [handleInputChange]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              {agentName || agentId}
            </h2>
            <p className="text-xs text-muted-foreground">
              AI Assistant • Online
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary">Active</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                <p className="text-sm text-muted-foreground">
                  Ask {agentName || "agent"} anything. I'm here to help!
                </p>
              </div>
            )}
            
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-primary"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                <p className="text-sm text-destructive">
                  <span className="font-medium">Error:</span> {error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <ChatInput
            value={input}
            onChange={handleInputValueChange}
            onSendMessage={handleSendMessage}
            disabled={isLoading}
            placeholder={`Message ${agentName || "agent"}...`}
          />
        </div>
      </div>
    </div>
  );
}