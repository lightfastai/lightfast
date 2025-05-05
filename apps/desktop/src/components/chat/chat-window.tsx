import type { UIMessage } from "ai";
import { useMemo } from "react";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { cn } from "@/lib/utils";
import { SessionChatV1Status } from "@/types/internal";
import { Terminal } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

import { ChatMessage } from "./chat-message";

interface ChatWindowProps {
  messages: UIMessage[];
  status?: SessionChatV1Status;
  error?: Error | null;
  className?: string;
  addToolResult?: (params: { toolCallId: string; result: any }) => void;
}

export function ChatWindow({
  messages,
  status,
  error,
  className,
  addToolResult,
}: ChatWindowProps) {
  const { containerRef } = useScrollToBottom();

  const isStreamingOrSubmitted = useMemo(() => {
    return status === "streaming" || status === "submitted";
  }, [status]);

  return (
    <div className={cn("flex h-full flex-col overflow-y-auto p-4", className)}>
      <ScrollArea className="h-full" ref={containerRef}>
        <div className="flex-1 space-y-4">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id ?? `message-${index}`}
              message={message}
              status={status}
              addToolResult={addToolResult}
            />
          ))}
          {isStreamingOrSubmitted &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <ChatMessage
                key="assistant-thinking"
                message={{
                  id: "assistant-thinking",
                  role: "assistant",
                  content: "",
                  parts: [],
                }}
                status={status}
              />
            )}
          <div ref={containerRef} />
        </div>

        {error && (
          <Alert variant="destructive" className="my-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
      </ScrollArea>
    </div>
  );
}
