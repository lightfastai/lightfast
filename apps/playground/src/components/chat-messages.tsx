"use client";

import type { ChatStatus, ToolUIPart } from "ai";
import { getToolName } from "ai";
import { ArrowDown } from "lucide-react";
import { memo, useMemo, useRef } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Markdown } from "@repo/ui/components/markdown";
import { ThinkingAccordion } from "./thinking-accordion";
import { ToolRenderer } from "./tool-renderers";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import type { PlaygroundUIMessage } from "~/types/playground-ui-messages";
import { isReasoningPart, isTextPart, isToolPart } from "~/types/playground-ui-messages";

interface ChatMessagesProps {
  messages: PlaygroundUIMessage[];
  status: ChatStatus;
}

// Extended message type that includes runtime status
interface MessageWithRuntimeStatus extends PlaygroundUIMessage {
  runtimeStatus?: "thinking" | "streaming" | "reasoning" | "done";
  reasoningText?: string;
}

function ScrollButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <Button
        onClick={() => scrollToBottom()}
        className="absolute bottom-4 right-4 rounded-full p-2 shadow-lg transition-all duration-200"
        variant="secondary"
        size="icon"
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    )
  );
}

export function ChatMessages({ messages, status }: ChatMessagesProps) {
  // Track initial message count for scroll anchor
  const initialMessageCount = useRef<number | null>(null);
  if (initialMessageCount.current === null) {
    initialMessageCount.current = messages.length;
  }

  // Add runtime status to messages and inject thinking placeholder
  const messagesWithStatus: MessageWithRuntimeStatus[] = messages.map((msg, index) => {
    if (index === messages.length - 1) {
      if (msg.role === "assistant" && status === "streaming") {
        return { ...msg, runtimeStatus: "streaming" };
      }
    }
    if (msg.role === "assistant") {
      return { ...msg, runtimeStatus: "done" };
    }
    return msg;
  });

  // Add a placeholder assistant message when submitted
  if (status === "submitted" && messages[messages.length - 1]?.role === "user") {
    messagesWithStatus.push({
      id: "thinking-placeholder",
      role: "assistant",
      parts: [],
      runtimeStatus: "thinking",
    });
  }

  return (
    <div className="flex-1 relative min-h-0 overflow-hidden scrollbar-hide-all">
      <StickToBottom 
        className="absolute inset-0 flex overflow-y-auto"
        resize="smooth"
        initial="instant"
        role="log"
      >
        <StickToBottom.Content className="flex w-full flex-col py-4 px-4">
          {messagesWithStatus.map((message, index) => {
            const isLast = index === messagesWithStatus.length - 1;
            const hasScrollAnchor = isLast && messagesWithStatus.length > initialMessageCount.current;
            
            return (
              <MessageItem
                key={message.id}
                message={message}
                hasScrollAnchor={hasScrollAnchor}
              />
            );
          })}
        </StickToBottom.Content>
        <ScrollButton />
      </StickToBottom>
    </div>
  );
}

function MessageItem({
  message,
  hasScrollAnchor,
}: {
  message: MessageWithRuntimeStatus;
  hasScrollAnchor?: boolean;
}) {
  // Extract reasoning text and determine if actively streaming reasoning
  const { hasActiveReasoningPart, reasoningText } = useMemo(() => {
    // Extract all reasoning text
    const allReasoningText = message.parts
      ?.filter(isReasoningPart)
      .map(part => part.text)
      .join('');
      
    // Check if actively streaming reasoning
    const isStreamingReasoning = message.runtimeStatus === "streaming" && 
      message.parts && 
      message.parts.length > 0 &&
      isReasoningPart(message.parts[message.parts.length - 1]);
      
    return {
      hasActiveReasoningPart: isStreamingReasoning,
      reasoningText: allReasoningText
    };
  }, [message.parts, message.runtimeStatus]);

  // For user messages
  if (message.role === "user") {
    const textContent =
      message.parts
        ?.filter(isTextPart)
        .map((part) => part.text)
        .join("\n") || "";

    return (
      <div className={cn("py-3", hasScrollAnchor && "min-h-[25vh]")}>
        <div className="mx-auto max-w-3xl flex justify-end">
          <div className="max-w-[80%] border border-muted/30 rounded-xl px-4 py-1 bg-transparent dark:bg-input/30">
            <p className="whitespace-pre-wrap text-sm">{textContent}</p>
          </div>
        </div>
      </div>
    );
  }

  // For assistant messages, render parts in order
  return (
    <div className={cn("py-3", hasScrollAnchor && "min-h-[25vh]")}>
      <div className="mx-auto max-w-3xl px-4 space-y-4">
        {/* Show thinking accordion at top of assistant message */}
        {message.runtimeStatus && message.runtimeStatus !== "done" && (
          <ThinkingAccordion 
            status={hasActiveReasoningPart ? "reasoning" : 
                   (message.runtimeStatus === "streaming" && !message.parts?.length) ? "thinking" : 
                   message.runtimeStatus} 
            reasoningText={reasoningText}
          />
        )}
        {/* Show completed thinking with reasoning text if available */}
        {message.runtimeStatus === "done" && reasoningText && (
          <ThinkingAccordion 
            status="done" 
            reasoningText={reasoningText}
          />
        )}
        {message.parts?.map((part, index) => {
          // Text part
          if (isTextPart(part)) {
            return (
              <div key={`${message.id}-part-${index}`} className="w-full px-4 text-sm">
                <Markdown>{part.text}</Markdown>
              </div>
            );
          }

          // Skip reasoning parts as they're now handled in ThinkingAccordion
          if (isReasoningPart(part)) {
            return null;
          }

          // Tool part
          if (isToolPart(part)) {
            const toolPart = part as ToolUIPart;
            const toolName = getToolName(toolPart);
            return (
              <div key={`${message.id}-part-${index}`} className="w-full">
                <ToolRenderer toolPart={toolPart} toolName={toolName as string} />
              </div>
            );
          }

          // Unknown part type
          return null;
        })}
      </div>
    </div>
  );
}