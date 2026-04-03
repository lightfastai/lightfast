"use client";

import { useChat } from "@ai-sdk/react";
import type {
  PromptInputMessage,
  PromptInputRef,
} from "@repo/ui/components/ai-elements/prompt-input";
import { toast } from "@repo/ui/components/ui/sonner";
import { addBreadcrumb } from "@sentry/nextjs";
import type { UIMessage } from "ai";
import { useRef, useState, useSyncExternalStore } from "react";
import { useAnswerTransport } from "~/ai/hooks/use-answer-transport";
import { AnswerMessages } from "./answer-messages";
import { AnswerPromptInput } from "./answer-prompt-input";
import { AskLightfastSuggestions } from "./ask-lightfast-suggestions";

interface AnswerInterfaceProps {
  clerkOrgId: string;
}

const emptySubscribeCleanup = () => {
  /* no cleanup needed */
};
const emptySubscribe = () => emptySubscribeCleanup;

export function AnswerInterface({ clerkOrgId }: AnswerInterfaceProps) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const formRef = useRef<PromptInputRef | null>(null);

  const transport = useAnswerTransport({
    sessionId,
    clerkOrgId,
  });

  const { messages, sendMessage, status } = useChat({
    transport,
    id: sessionId,
  });

  // Helper to validate and send messages - mirrors chat-interface.tsx pattern
  // Returns true if message was queued, false if validation failed
  const handleSendMessage = (text: string): boolean => {
    const trimmedText = text.trim();

    // Guard: empty input, already streaming, or already submitted
    if (!trimmedText || status === "streaming" || status === "submitted") {
      return false;
    }

    const userMessage: UIMessage = {
      role: "user",
      parts: [{ type: "text", text: trimmedText }],
      id: crypto.randomUUID(),
    };

    // Log breadcrumb for debugging
    addBreadcrumb({
      category: "answer-ui",
      message: "send_message",
      data: {
        clerkOrgId,
        sessionId,
        length: trimmedText.length,
      },
    });

    // Fire-and-forget - matches chat-interface.tsx pattern
    sendMessage(userMessage).catch((error: unknown) => {
      console.error("Failed to send message:", error);

      // Show user-friendly error toast
      toast.error("Failed to send message", {
        description: "Please try again",
        duration: 4000,
      });
    });

    return true;
  };

  const handleSubmit = async (promptMessage: PromptInputMessage) => {
    await Promise.resolve(); // Satisfy linter - function must be async for prop signature
    const text = promptMessage.text ?? "";
    const success = handleSendMessage(text);

    // Clear form only if message was successfully queued
    if (success && formRef.current) {
      formRef.current.reset();
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    const success = handleSendMessage(prompt);

    // Clear form only if message was successfully queued
    if (success && formRef.current) {
      formRef.current.reset();
    }
  };

  // Disable submit button while streaming or submitting
  const isSubmitDisabled = status === "streaming" || status === "submitted";

  // Provide helpful reason for why submit is disabled
  const submitDisabledReason =
    status === "streaming"
      ? "Processing response..."
      : status === "submitted"
        ? "Sending message..."
        : undefined;

  if (!isClient) {
    return null;
  }

  // Empty state view - centered layout with heading, input, and suggestions (matching chat app style)
  if (messages.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-background">
        <div className="-mt-24 w-full max-w-3xl px-1.5 md:px-3 lg:px-6 xl:px-10">
          <div className="mb-8">
            <div className="flex flex-col items-center justify-center">
              <p className="text-center font-semibold text-3xl">
                Explore your infrastructure
              </p>
            </div>
          </div>
          <AnswerPromptInput
            isSubmitDisabled={isSubmitDisabled}
            onSubmit={handleSubmit}
            placeholder="Ask anything about your workspace..."
            ref={formRef}
            status={status}
            submitDisabledReason={submitDisabledReason}
          />
          {/* Prompt suggestions - only visible on tablet and above (md breakpoint) */}
          <div className="relative mt-4 hidden h-12 md:block">
            <div className="absolute top-0 right-0 left-0">
              <AskLightfastSuggestions onSelectPrompt={handleSuggestionClick} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Conversation view - full layout with messages and bottom input (matching chat app style)
  return (
    <div className="flex h-full w-full flex-col bg-background pb-4">
      {/* Messages area */}
      <AnswerMessages messages={messages} status={status} />

      {/* Input area */}
      <div className="relative w-full">
        <div className="mx-auto max-w-3xl px-1.5 md:px-3 lg:px-6 xl:px-10">
          <div className="flex-shrink-0">
            <div className="answer-container relative px-1.5 md:px-3 lg:px-5 xl:px-8">
              {/* Gradient overlay */}
              <div className="pointer-events-none absolute -top-24 right-0 left-0 z-10 h-24">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
              </div>

              <AnswerPromptInput
                isSubmitDisabled={isSubmitDisabled}
                onSubmit={handleSubmit}
                placeholder="Continue the conversation..."
                ref={formRef}
                status={status}
                submitDisabledReason={submitDisabledReason}
              />
            </div>

            {/* Description text */}
            <div className="answer-container px-1.5 md:px-3 lg:px-5 xl:px-8">
              <p className="mt-2 text-center text-muted-foreground text-xs">
                AI may make mistakes. Use with discretion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
