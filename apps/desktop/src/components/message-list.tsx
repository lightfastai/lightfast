import type { UIMessage } from "ai";
import { SessionChatV1Status } from "@/types/internal";
import { Terminal } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";

import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";

interface MessageListProps {
  messages: UIMessage[];
  status: SessionChatV1Status;
  error?: Error | null;
  className?: string;
  addToolResult: (params: { toolCallId: string; result: any }) => void;
}

export function MessageList({
  messages,
  status,
  error,
  className,
  addToolResult,
}: MessageListProps) {
  return (
    <div className={cn("flex h-full flex-col overflow-y-auto", className)}>
      <ScrollArea className="h-full">
        <div className="flex-1 space-y-4">
          {messages.map((message, index) => {
            switch (message.role) {
              case "user":
                return (
                  <UserMessage
                    message={message}
                    addToolResult={addToolResult}
                  />
                );
              case "assistant":
                return (
                  <AssistantMessage
                    message={message}
                    status={status}
                    addToolResult={addToolResult}
                  />
                );
              default:
                return null;
            }
          })}
          {/* {isStreamingOrSubmitted &&
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
            )} */}
          {/* <div ref={containerRef} /> */}
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
