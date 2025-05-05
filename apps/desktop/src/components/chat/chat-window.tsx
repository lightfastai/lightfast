import type { Message } from "ai";
import { useEffect, useRef } from "react";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { cn } from "@/lib/utils";
import { ArrowDown } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

import { ChatMessage } from "./chat-message";
import { StatusMessage } from "./status-message";

interface ChatWindowProps {
  messages: Message[];
  testResult: {
    success: boolean;
    message: string;
  } | null;
  status: "submitted" | "streaming" | "ready" | "error" | "idle";
  error: Error | null;
  onDismissTestResult: () => void;
  className?: string;
}

export function ChatWindow({
  messages,
  testResult,
  status,
  error,
  onDismissTestResult,
  className,
}: ChatWindowProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isAtBottom, scrollToBottom, containerRef } = useScrollToBottom();

  // Set the scrollAreaRef as the container for the scroll-to-bottom hook
  useEffect(() => {
    if (scrollAreaRef.current) {
      containerRef(scrollAreaRef.current);
    }
  }, [containerRef]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      scrollToBottom();
    }
  }, [messages, status, scrollToBottom]);

  // Map the status to one that ChatMessage component accepts
  const chatMessageStatus = status === "idle" ? "ready" : status;

  return (
    <div className={cn("relative flex h-full flex-col", className)}>
      <ScrollArea className="h-full">
        <div
          ref={scrollAreaRef}
          className="flex flex-col overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center space-y-4 pb-20">
              <div className="bg-background rounded-lg border p-8 shadow-sm">
                <div className="flex flex-col items-center space-y-2 text-center">
                  <h1 className="text-xl font-semibold">
                    Welcome to Lightfast
                  </h1>
                  <p className="text-muted-foreground max-w-md text-sm">
                    Ask anything about your codebase or how to accomplish tasks.
                    I can help with code generation, explanations, and
                    debugging.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Test operation status message */}
              <StatusMessage
                testResult={testResult}
                onDismiss={onDismissTestResult}
              />

              {error && (
                <div className="bg-destructive/15 text-destructive rounded-lg p-4">
                  <div className="flex gap-2">
                    <span className="font-semibold">Error:</span>
                    <span>{error.message}</span>
                  </div>
                </div>
              )}

              {/* Display messages */}
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  status={chatMessageStatus}
                />
              ))}

              {/* Reference to scroll to the bottom */}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Scroll to bottom button, shown only when not at bottom */}
      {!isAtBottom && messages.length > 0 && (
        <Button
          className="absolute right-4 bottom-4 rounded-full p-2 shadow-lg"
          size="icon"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
