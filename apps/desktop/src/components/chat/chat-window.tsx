import type { Message } from "ai";

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
  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Test operation status message */}
      <StatusMessage testResult={testResult} onDismiss={onDismissTestResult} />

      <div className="space-y-2">
        {error && (
          <div className="flex justify-start">
            <div className="bg-destructive text-destructive-foreground max-w-[80%] rounded-2xl px-4 py-2.5">
              Error: {error.message}
            </div>
          </div>
        )}

        {/* Display messages */}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
            <div className="bg-muted-foreground h-2 w-2 animate-pulse rounded-full" />
            Thinking...
          </div>
        )}
      </div>
    </div>
  );
}
