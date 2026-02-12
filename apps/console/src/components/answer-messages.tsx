"use client";

import React, { Fragment, useState } from "react";
import type {
  ChatStatus,
  UIMessage,
  TextUIPart,
  ReasoningUIPart,
  ToolUIPart,
} from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@repo/ui/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
} from "@repo/ui/components/ai-elements/message";
import { Response } from "@repo/ui/components/ai-elements/response";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/ui/components/ai-elements/reasoning";
import { Actions, Action } from "@repo/ui/components/ai-elements/actions";
import { Copy, Check } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { ToolCallRenderer } from "./answer-tool-call-renderer";

function isTextPart(part: UIMessage["parts"][number]): part is TextUIPart {
  return part.type === "text";
}

function isReasoningPart(
  part: UIMessage["parts"][number],
): part is ReasoningUIPart {
  return part.type === "reasoning";
}

function isToolPart(part: UIMessage["parts"][number]): boolean {
  return typeof part.type === "string" && part.type.startsWith("tool-");
}

// Simple copy hook
function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false);
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };
  return { isCopied, copy };
}

interface AnswerMessagesProps {
  messages: UIMessage[];
  status: ChatStatus;
}

// Helper to extract text content from a message's parts
function getTextContent(message: UIMessage): string {
  return message.parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join("\n");
}

// User message - display text content
function UserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const textContent = getTextContent(message);

  return (
    <div className="py-1">
      <div className="mx-auto max-w-3xl px-4 lg:px-14 xl:px-20">
        <Message from="user" className="justify-end">
          <MessageContent variant="chat">
            {textContent.trim().length > 0 && (
              <p className="whitespace-pre-wrap text-sm">{textContent}</p>
            )}
          </MessageContent>
        </Message>
      </div>
    </div>
  );
}

// Assistant message - parts-based rendering
function AssistantMessage({
  message,
  isCurrentlyStreaming,
}: {
  message: UIMessage;
  isCurrentlyStreaming: boolean;
}) {
  const { isCopied, copy } = useCopyToClipboard();

  const handleCopy = () => {
    copy(getTextContent(message));
  };

  const hasMeaningful = message.parts.some((part) => {
    if (isTextPart(part) && part.text.trim().length > 1) return true;
    if (isToolPart(part)) return true;
    if (isReasoningPart(part) && part.text.trim().length > 1) return true;
    return false;
  });

  const showLoading = isCurrentlyStreaming && !hasMeaningful;

  return (
    <div className="py-1">
      <div className="mx-auto max-w-3xl px-4 lg:px-14 xl:px-20">
        <Message
          from="assistant"
          className="flex-col items-start [&>div]:max-w-full"
        >
          <div className="relative w-full">
            {/* Loading indicator */}
            {showLoading && (
              <div className="flex items-center gap-1 py-2">
                <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce" />
                <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce [animation-delay:100ms]" />
                <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce [animation-delay:200ms]" />
              </div>
            )}

            {/* Parts rendering */}
            <div
              className={cn(
                "space-y-1 w-full",
                showLoading && "opacity-0 pointer-events-none",
              )}
            >
              {message.parts.map((part, index) => {
                if (isTextPart(part)) {
                  return (
                    <MessageContent
                      key={`${message.id}-text-${index}`}
                      variant="chat"
                      className="w-full py-0"
                    >
                      <Response>{part.text}</Response>
                    </MessageContent>
                  );
                }

                if (isReasoningPart(part) && part.text.length > 1) {
                  const trimmedText = part.text.replace(/^\n+/, "");
                  const isReasoningStreaming =
                    isCurrentlyStreaming && index === message.parts.length - 1;
                  return (
                    <div
                      key={`${message.id}-reasoning-${index}`}
                      className="w-full"
                    >
                      <Reasoning
                        className="w-full"
                        isStreaming={isReasoningStreaming}
                      >
                        <ReasoningTrigger />
                        <ReasoningContent>{trimmedText}</ReasoningContent>
                      </Reasoning>
                    </div>
                  );
                }

                if (isToolPart(part)) {
                  const toolName = part.type.replace("tool-", "");
                  return (
                    <div
                      key={`${message.id}-tool-${index}`}
                      className="w-full py-2"
                    >
                      <ToolCallRenderer
                        toolPart={part as ToolUIPart}
                        toolName={toolName}
                      />
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>

          {/* Actions */}
          {hasMeaningful && !isCurrentlyStreaming && (
            <div className="w-full mt-2">
              <div className="flex items-center justify-end min-h-[2rem]">
                <Actions>
                  <Action tooltip="Copy message" onClick={handleCopy}>
                    {isCopied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Action>
                </Actions>
              </div>
            </div>
          )}
        </Message>
      </div>
    </div>
  );
}

// Build turns from messages: pair user messages with assistant responses
interface Turn {
  kind: "answer" | "pending";
  user: UIMessage;
  assistant?: UIMessage;
  isStreaming: boolean;
}

function buildTurns(messages: UIMessage[], status: ChatStatus): Turn[] {
  const turns: Turn[] = [];
  const isStreamingStatus = status === "submitted" || status === "streaming";
  let pendingUser: UIMessage | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      if (pendingUser) {
        // Previous user message had no response
        turns.push({
          kind: "pending",
          user: pendingUser,
          isStreaming: false,
        });
      }
      pendingUser = message;
      continue;
    }

    if (message.role === "assistant") {
      if (pendingUser) {
        turns.push({
          kind: "answer",
          user: pendingUser,
          assistant: message,
          isStreaming:
            isStreamingStatus && message === messages[messages.length - 1],
        });
        pendingUser = null;
      }
      continue;
    }
  }

  // Trailing user message with no response yet
  if (pendingUser) {
    turns.push({
      kind: "pending",
      user: pendingUser,
      isStreaming: isStreamingStatus,
    });
  }

  return turns;
}

export function AnswerMessages({ messages, status }: AnswerMessagesProps) {
  const turns = buildTurns(messages, status);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Conversation className="flex-1 scrollbar-thin" resize="smooth">
        <ConversationContent className="flex flex-col p-0 last:pb-12">
          {messages.length === 0 && status === "ready" && (
            <div className="py-8">
              <div className="mx-auto max-w-3xl px-4 lg:px-14 xl:px-20">
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">Ask a question about your workspace</p>
                </div>
              </div>
            </div>
          )}

          {turns.map((turn) => {
            if (turn.kind === "answer" && turn.assistant) {
              return (
                <Fragment key={turn.user.id}>
                  <UserMessage message={turn.user} />
                  <AssistantMessage
                    message={turn.assistant}
                    isCurrentlyStreaming={turn.isStreaming}
                  />
                </Fragment>
              );
            }

            // Pending: user sent, waiting for response
            return (
              <Fragment key={turn.user.id}>
                <UserMessage message={turn.user} />
                {turn.isStreaming && (
                  <div className="py-1">
                    <div className="mx-auto max-w-3xl px-4 lg:px-14 xl:px-20">
                      <Message
                        from="assistant"
                        className="flex-col items-start"
                      >
                        <div className="flex items-center gap-1 py-2">
                          <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce" />
                          <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce [animation-delay:100ms]" />
                          <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce [animation-delay:200ms]" />
                        </div>
                      </Message>
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
        </ConversationContent>
        {messages.length > 0 && (
          <ConversationScrollButton
            className="absolute bottom-4 z-20 right-4 rounded-full shadow-lg"
            variant="secondary"
            size="icon"
          />
        )}
      </Conversation>
    </div>
  );
}
