import { cn } from "@repo/ui/lib/utils";
import {
  Message,
  MessageActions,
  MessageContent,
} from "@repo/ui-v2/components/ai-elements/message";
import type { UIMessage } from "@vendor/ai";
import { memo } from "react";
import { extractMessageText, MessageCopyButton } from "./message-copy-button";
import { WorkspaceAssistantMessagePart } from "./message-part";

export const ChatMessage = memo(function ChatMessage({
  isStreaming,
  message,
}: {
  isStreaming: boolean;
  message: UIMessage;
}) {
  const copyText = extractMessageText(message);
  return (
    <Message className="relative" from={message.role}>
      <MessageContent
        className={cn(
          message.role === "assistant" &&
            "w-full max-w-none bg-transparent px-0 py-0"
        )}
      >
        {message.parts.map((part, index) => (
          <WorkspaceAssistantMessagePart
            isStreaming={isStreaming}
            key={`${message.id}-${index}`}
            part={part}
          />
        ))}
      </MessageContent>
      {copyText ? (
        <MessageActions
          className={cn(
            "absolute top-full mt-2 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100",
            message.role === "user" ? "right-0" : "left-0"
          )}
        >
          <MessageCopyButton text={copyText} />
        </MessageActions>
      ) : null}
    </Message>
  );
});
