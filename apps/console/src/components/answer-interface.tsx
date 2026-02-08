"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { addBreadcrumb } from "@sentry/nextjs";
import { toast } from "@repo/ui/components/ui/sonner";
import { useAnswerTransport } from "~/ai/hooks/use-answer-transport";
import { AnswerMessages } from "./answer-messages";
import { AskLightfastSuggestions } from "./ask-lightfast-suggestions";
import { AnswerPromptInput } from "./answer-prompt-input";
import type {
  PromptInputMessage,
  PromptInputRef,
} from "@repo/ui/components/ai-elements/prompt-input";

interface AnswerInterfaceProps {
  workspaceId: string;
}

export function AnswerInterface({ workspaceId }: AnswerInterfaceProps) {
  const [sessionId, setSessionId] = useState<string>("");
  const [isClient, setIsClient] = useState(false);
  const formRef = useRef<PromptInputRef | null>(null);

  // Generate session ID on mount (client-only)
  useEffect(() => {
    setSessionId(crypto.randomUUID());
    setIsClient(true);
  }, []);

  const transport = useAnswerTransport({
    sessionId,
    workspaceId,
  });

  const { messages, sendMessage, status } = useChat({
    transport,
    id: sessionId,
  });

  // Helper to validate and send messages - mirrors chat-interface.tsx pattern
  // Returns true if message was queued, false if validation failed
  const handleSendMessage = useCallback(
    (text: string): boolean => {
      const trimmedText = text.trim();

      // Guard: empty input, already streaming, or already submitted
      if (
        !trimmedText ||
        status === "streaming" ||
        status === "submitted"
      ) {
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
          workspaceId,
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
    },
    [sendMessage, status, workspaceId, sessionId],
  );

  const handleSubmit = useCallback(
    async (promptMessage: PromptInputMessage) => {
      await Promise.resolve(); // Satisfy linter - function must be async for prop signature
      const text = promptMessage.text ?? "";
      const success = handleSendMessage(text);

      // Clear form only if message was successfully queued
      if (success && formRef.current) {
        formRef.current.reset();
      }
    },
    [handleSendMessage],
  );

  const handleSuggestionClick = useCallback(
    (prompt: string) => {
      const success = handleSendMessage(prompt);

      // Clear form only if message was successfully queued
      if (success && formRef.current) {
        formRef.current.reset();
      }
    },
    [handleSendMessage],
  );

  // Disable submit button while streaming or submitting
  const isSubmitDisabled = status === "streaming" || status === "submitted";

  // Provide helpful reason for why submit is disabled
  const submitDisabledReason =
    status === "streaming" ? "Processing response..." :
    status === "submitted" ? "Sending message..." :
    undefined;

  if (!isClient) {
    return null;
  }

  // Empty state view - centered layout with heading, input, and suggestions (matching chat app style)
  if (messages.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-background">
        <div className="w-full -mt-24 max-w-3xl px-1.5 md:px-3 lg:px-6 xl:px-10">
          <div className="mb-8">
            <div className="flex flex-col items-center justify-center">
              <p className="text-3xl font-semibold text-center">
                Explore your infrastructure
              </p>
            </div>
          </div>
          <AnswerPromptInput
            ref={formRef}
            placeholder="Ask anything about your workspace..."
            onSubmit={handleSubmit}
            status={status}
            isSubmitDisabled={isSubmitDisabled}
            submitDisabledReason={submitDisabledReason}
          />
          {/* Prompt suggestions - only visible on tablet and above (md breakpoint) */}
          <div className="hidden md:block relative mt-4 h-12">
            <div className="absolute top-0 left-0 right-0">
              <AskLightfastSuggestions onSelectPrompt={handleSuggestionClick} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Conversation view - full layout with messages and bottom input (matching chat app style)
  return (
    <div className="flex flex-col h-full w-full bg-background pb-4">
      {/* Messages area */}
      <AnswerMessages messages={messages} status={status} />

      {/* Input area */}
      <div className="relative w-full">
        <div className="max-w-3xl mx-auto px-1.5 md:px-3 lg:px-6 xl:px-10">
          <div className="flex-shrink-0">
            <div className="answer-container relative px-1.5 md:px-3 lg:px-5 xl:px-8">
              {/* Gradient overlay */}
              <div className="absolute -top-24 left-0 right-0 h-24 pointer-events-none z-10">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
              </div>

              <AnswerPromptInput
                ref={formRef}
                placeholder="Continue the conversation..."
                onSubmit={handleSubmit}
                status={status}
                isSubmitDisabled={isSubmitDisabled}
                submitDisabledReason={submitDisabledReason}
              />
            </div>

            {/* Description text */}
            <div className="answer-container px-1.5 md:px-3 lg:px-5 xl:px-8">
              <p className="text-xs text-muted-foreground text-center mt-2">
                AI may make mistakes. Use with discretion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
