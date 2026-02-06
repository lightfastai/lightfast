"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAnswerTransport } from "~/ai/hooks/use-answer-transport";
import { AnswerMessages } from "./answer-messages";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from "@repo/ui/components/ai-elements/prompt-input";
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
    (promptMessage: PromptInputMessage) => {
      const text = promptMessage.text?.trim();
      if (!text) return;

      const userMessage: UIMessage = {
        role: "user",
        parts: [{ type: "text", text }],
        id: crypto.randomUUID(),
      };

      sendMessage(userMessage)
        .catch((error: unknown) => {
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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages area */}
      <AnswerMessages messages={messages} status={status} />

      {/* Input area */}
      <div className="relative">
        <div className="max-w-3xl mx-auto px-1.5 md:px-3 lg:px-6 xl:px-10">
          <div className="flex-shrink-0">
            <div className="relative px-1.5 md:px-3 lg:px-5 xl:px-8">
              {/* Gradient overlay */}
              <div className="absolute -top-24 left-0 right-0 h-24 pointer-events-none z-10">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
              </div>

              <PromptInput
                ref={formRef}
                onSubmit={handleSubmit}
              >
                <PromptInputBody>
                  <PromptInputTextarea
                    placeholder={
                      messages.length === 0
                        ? "Ask anything about your workspace..."
                        : "Continue the conversation..."
                    }
                  />
                </PromptInputBody>
                <PromptInputToolbar>
                  <PromptInputTools />
                  <PromptInputSubmit status={status} />
                </PromptInputToolbar>
              </PromptInput>
            </div>

            {messages.length > 0 && (
              <div className="px-1.5 md:px-3 lg:px-5 xl:px-8">
                <p className="text-xs text-muted-foreground text-center mt-2">
                  AI may make mistakes. Use with discretion.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
