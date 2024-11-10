"use client";

import type { Message as AIChatMessage } from "ai";
import { useState } from "react";
import { useChat } from "ai/react";

import { Input } from "@repo/ui/components/ui/input";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

import { Texture } from "./texture/types";

type ChatMessage = {
  id: string;
  type: "user" | "idea" | "texture";
  content: string | Texture[];
};

export const TextureAIGenerator = () => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isGeneratingTexture, setIsGeneratingTexture] = useState(false);

  const {
    messages: ideaMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useChat({
    api: "/api/chat/idea",
    body: {
      model: "gpt-4o",
    },
    onFinish: async (message: AIChatMessage) => {
      await generateTexture(message.content);
    },
  });

  const generateTexture = async (idea: string) => {
    setIsGeneratingTexture(true);
    try {
      const response = await fetch("/api/chat/generate-texture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: idea, model: "gpt-4o" }),
      });

      const data = await response.json();
      setChatMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), type: "texture", content: data.textures },
      ]);
    } catch (error) {
      console.error("Error generating texture:", error);
    } finally {
      setIsGeneratingTexture(false);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setChatMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), type: "user", content: input },
    ]);
    handleSubmit(e);
  };

  // Combine all messages in chronological order
  const allMessages = [
    ...chatMessages,
    ...ideaMessages
      .filter((m) => m.role === "assistant")
      .map((m) => ({
        id: m.id,
        type: "idea" as const,
        content: m.content,
      })),
  ].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="relative flex h-full flex-col">
      {/* Messages Display with ScrollArea */}
      <ScrollArea className="flex-1 pb-[144px]">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
          {allMessages.map((message) => {
            if (message.type === "idea") {
              return (
                <div
                  key={message.id}
                  className="mr-auto max-w-[80%] space-y-2 rounded-lg border bg-card p-4"
                >
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    Generated Idea
                  </h2>
                  <div className="text-sm leading-relaxed text-foreground">
                    {message.content as string}
                  </div>
                </div>
              );
            }

            if (message.type === "user") {
              return (
                <div
                  key={message.id}
                  className="mx-auto max-w-[80%] rounded-lg bg-primary p-4"
                >
                  <p className="text-sm text-primary-foreground">
                    {message.content as string}
                  </p>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className="mr-auto max-w-[80%] rounded-lg border bg-card p-4"
              >
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Generated Texture Data
                </h2>
                <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-sm">
                  {JSON.stringify(message.content, null, 2)}
                </pre>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input Area - Fixed above footer */}
      <div className="absolute bottom-[52px] left-0 right-0 border-t bg-background p-4">
        <div className="mx-auto max-w-4xl">
          <form onSubmit={onSubmit} className="relative">
            <Input
              value={input}
              placeholder="Describe the texture you want..."
              onChange={handleInputChange}
              disabled={isLoading || isGeneratingTexture}
              className="pr-12"
            />
            {(isLoading || isGeneratingTexture) && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
