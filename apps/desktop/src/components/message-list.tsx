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
import { UserMessageInput } from "./user-message-input";

interface MessageListProps {
  messages: UIMessage[];
  status: SessionChatV1Status;
  error?: Error | null;
  className?: string;
  addToolResult: (params: { toolCallId: string; result: any }) => void;
  input: string;
  setInput: (input: string) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  stop?: () => void;
  setMessages?: (messages: any) => void;
}

export function MessageList({
  messages,
  status,
  error,
  className,
  addToolResult,
  input,
  setInput,
  handleSubmit,
  stop,
  setMessages,
}: MessageListProps) {
  return (
    <div className={cn("flex h-full flex-col overflow-y-auto", className)}>
      <ScrollArea className="h-full">
        <div className="flex-1 space-y-4">
          {messages.map((message, index) => {
            if (message.role === "user") {
              console.log("rendering", message.content);

              const isLastMessage = index === messages.length - 1;
              const isChatProcessing =
                status === "submitted" || status === "streaming";

              let itemStatus: "thinking" | "done" = "done";
              let itemStop = undefined;

              if (isLastMessage && isChatProcessing) {
                itemStatus = "thinking";
                itemStop = stop;
              }

              return (
                <div key={message.id}>
                  <UserMessageInput
                    input={message.content || ""}
                    setInput={() => {}}
                    status={itemStatus}
                    stop={itemStop}
                    handleSubmit={(e) => e.preventDefault()}
                    setMessages={undefined}
                    className="w-full"
                  />
                </div>
              );
            }
            if (message.role === "assistant") {
              return (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  status={status}
                  addToolResult={addToolResult}
                />
              );
            }
            return null;
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
