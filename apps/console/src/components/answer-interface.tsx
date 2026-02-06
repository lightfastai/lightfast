"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
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

  const handleSubmit = useCallback(
    async (promptMessage: PromptInputMessage) => {
      const text = promptMessage.text?.trim();
      if (!text) return;

      const userMessage: UIMessage = {
        role: "user",
        parts: [{ type: "text", text }],
        id: crypto.randomUUID(),
      };

      try {
        await sendMessage(userMessage);
      } catch (error: unknown) {
        console.error("Failed to send message:", error);
      }

      // Clear the input form
      formRef.current?.reset();
    },
    [sendMessage],
  );

  const handleSuggestionClick = useCallback(
    (prompt: string) => {
      const userMessage: UIMessage = {
        role: "user",
        parts: [{ type: "text", text: prompt }],
        id: crypto.randomUUID(),
      };

      sendMessage(userMessage).catch((error: unknown) => {
        console.error("Failed to send message:", error);
      });

      // Clear the input form
      formRef.current?.reset();
    },
    [sendMessage],
  );

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
            isSubmitDisabled={false}
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
                isSubmitDisabled={false}
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
