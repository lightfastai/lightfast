import { cn } from "@repo/ui/lib/utils";
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
    <article
      className={cn(
        "group relative flex w-full",
        message.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          message.role === "user" &&
            "max-w-[80%] rounded-3xl bg-muted px-5 py-2 text-base leading-6",
          message.role === "assistant" &&
            "w-full max-w-none bg-transparent px-0 py-0 text-base leading-7"
        )}
      >
        {message.parts.map((part, index) => (
          <WorkspaceAssistantMessagePart
            isStreaming={isStreaming}
            key={`${message.id}-${index}`}
            part={part}
          />
        ))}
      </div>
      {copyText ? (
        <div
          className={cn(
            "absolute top-full mt-2 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100",
            message.role === "user" ? "right-0" : "left-0"
          )}
        >
          <MessageCopyButton text={copyText} />
        </div>
      ) : null}
    </article>
  );
});
