import type { Message } from "ai";
import { useEffect, useRef } from "react";

import { ChatMessage } from "./chat-message";
import { StatusMessage } from "./status-message";

interface ChatWindowProps {
  messages: Message[];
  testResult: {
    success: boolean;
    message: string;
  } | null;
  isLoading: boolean;
  error: Error | null | undefined;
  onDismissTestResult: () => void;
}

export function ChatWindow({
  messages,
  testResult,
  isLoading,
  error,
  onDismissTestResult,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center space-y-4 pb-20">
          <div className="bg-background rounded-lg border p-8 shadow-sm">
            <div className="flex flex-col items-center space-y-2 text-center">
              <h1 className="text-xl font-semibold">Welcome to Lightfast</h1>
              <p className="text-muted-foreground max-w-md text-sm">
                Ask anything about your codebase or how to accomplish tasks. I
                can help with code generation, explanations, and debugging.
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
            <ChatMessage key={message.id} message={message} />
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <div className="flex gap-1">
                <div
                  className="bg-muted-foreground/70 h-1 w-1 animate-bounce rounded-full"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="bg-muted-foreground/70 h-1 w-1 animate-bounce rounded-full"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="bg-muted-foreground/70 h-1 w-1 animate-bounce rounded-full"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span>Thinking...</span>
            </div>
          )}

          {/* Reference to scroll to the bottom */}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
