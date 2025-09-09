"use client";

import { ThinkingMessage } from "@repo/ui/components/chat";
import { cn } from "~/lib/utils";
import { type CloudChatMessage, isTextPart } from "~/types/chat-messages";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@repo/ui/components/ai-elements/conversation";
import { Message, MessageContent } from "@repo/ui/components/ai-elements/message";
import { Response } from "@repo/ui/components/ai-elements/response";

interface ChatMessagesProps {
  messages: CloudChatMessage[];
  isLoading?: boolean;
}

// Extended message type that includes runtime status
interface MessageWithRuntimeStatus extends CloudChatMessage {
  runtimeStatus?: "thinking" | "streaming" | "done";
}

export function ChatMessages({ messages, isLoading = false }: ChatMessagesProps) {
  // Add runtime status to messages and inject thinking placeholder
  const messagesWithStatus: MessageWithRuntimeStatus[] = messages.map(
    (msg, index) => {
      if (index === messages.length - 1) {
        if (msg.role === "assistant" && isLoading) {
          return { ...msg, runtimeStatus: "streaming" };
        }
      }
      if (msg.role === "assistant") {
        return { ...msg, runtimeStatus: "done" };
      }
      return msg;
    },
  );

  // Add a placeholder assistant message when loading
  if (isLoading && messages[messages.length - 1]?.role === "user") {
    messagesWithStatus.push({
      id: "thinking-placeholder",
      role: "assistant",
      parts: [],
      runtimeStatus: "thinking",
    });
  }

  // For new chats (no messages yet), show centered layout
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background">
        <div className="w-full max-w-3xl px-4">
          <div className="px-4 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">Start a conversation</h3>
              <p className="text-muted-foreground">
                Send a message to begin chatting with your AI agent.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Conversation className="flex-1 scrollbar-thin" resize="smooth">
        <ConversationContent className="flex flex-col p-0">
          {/* Messages container with proper padding */}
          <div className="flex-1 py-4">
            {messagesWithStatus.map((message, index) => {
              const isLast = index === messagesWithStatus.length - 1;
              return (
                <MessageItem
                  key={message.id}
                  message={message}
                  isLast={isLast}
                />
              );
            })}
          </div>
        </ConversationContent>
        <ConversationScrollButton
          className="absolute bottom-4 right-4 rounded-full shadow-lg transition-all duration-200"
          variant="secondary"
          size="icon"
        />
      </Conversation>
    </div>
  );
}

function MessageItem({
  message,
  isLast,
}: {
  message: MessageWithRuntimeStatus;
  isLast?: boolean;
}) {
  // For user messages
  if (message.role === "user") {
    const textContent = message.parts
      .filter(isTextPart)
      .map((part) => part.text)
      .join("\n");

    return (
      <div className="py-3">
        <div className="mx-auto max-w-3xl px-8">
          <Message from="user" className="justify-end">
            <MessageContent className="border border-muted/30 rounded-xl px-4 py-1 bg-transparent dark:bg-input/30 group-[.is-user]:bg-transparent group-[.is-user]:text-foreground">
              <p className="whitespace-pre-wrap text-sm">{textContent}</p>
            </MessageContent>
          </Message>
        </div>
      </div>
    );
  }

  // For assistant messages
  return (
    <div className={cn("py-3", isLast && "pb-8")}>
      <div className="mx-auto max-w-3xl px-4">
        <Message
          from="assistant"
          className="flex-col items-start gap-4 [&>div]:max-w-full"
        >
          {/* Show thinking animation at top of assistant message based on runtime status */}
          {message.runtimeStatus && (
            <div className="w-full px-4">
              <ThinkingMessage
                status={message.runtimeStatus}
                show={true}
              />
            </div>
          )}
          
          {/* Only show content if not just a thinking placeholder */}
          {message.parts.length > 0 && message.parts.some(isTextPart) && (
            <MessageContent className="w-full bg-transparent group-[.is-assistant]:bg-transparent px-8 py-0">
              <Response>
                {message.parts
                  .filter(isTextPart)
                  .map((part) => part.text)
                  .join("\n")}
              </Response>
            </MessageContent>
          )}
        </Message>
      </div>
    </div>
  );
}