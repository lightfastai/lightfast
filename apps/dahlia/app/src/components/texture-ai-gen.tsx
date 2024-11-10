"use client";

import type { Message as AIChatMessage } from "ai";
import { useState } from "react";
import { useChat } from "ai/react";
import { Loader2 } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
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
  const [currentTexture, setCurrentTexture] = useState<Texture[] | null>(null);

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
      setCurrentTexture(data.textures);
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

  const allMessages = [
    ...chatMessages,
    ...ideaMessages
      .filter((m) => m.role === "assistant")
      .map((m) => ({
        id: m.id,
        type: "idea" as const,
        content: m.content,
      })),
  ].sort((a, b) => a.id.localeCompare(a.id));

  return (
    <div className="relative flex h-full flex-col">
      <ScrollArea className="flex-1 px-4">
        <div className="mx-auto max-w-3xl pt-4">
          <div className="space-y-4 pb-[200px]">
            {allMessages.map((message) => {
              if (message.type === "user") {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="flex w-max max-w-[75%] flex-col gap-2 rounded-lg bg-primary px-4 py-3 text-primary-foreground">
                      <div className="text-sm">{message.content as string}</div>
                    </div>
                  </div>
                );
              }

              if (message.type === "idea") {
                return (
                  <div key={message.id} className="flex justify-start">
                    <div className="flex w-max max-w-[75%] flex-col gap-2 rounded-lg border bg-muted px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          AI Assistant
                        </span>
                      </div>
                      <div className="text-sm">{message.content as string}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id} className="flex justify-start">
                  <div className="flex w-max max-w-[75%] flex-col gap-2 rounded-lg border bg-muted px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        Generated Texture
                      </span>
                    </div>
                    <pre className="overflow-auto rounded bg-secondary/50 p-2 text-xs">
                      {JSON.stringify(message.content, null, 2)}
                    </pre>
                  </div>
                </div>
              );
            })}

            {(isGeneratingTexture || currentTexture) && (
              <div className="flex justify-start">
                <Card className="w-full max-w-[75%]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      {isGeneratingTexture ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating Texture
                        </>
                      ) : (
                        "Generated Texture"
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          Status
                        </div>
                        <div className="text-sm">
                          {isGeneratingTexture
                            ? "Processing texture pipeline..."
                            : "Texture generated successfully"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isGeneratingTexture
                            ? "This may take a few seconds"
                            : currentTexture &&
                              JSON.stringify(currentTexture, null, 2)}
                        </div>
                      </div>
                      <div className="aspect-square rounded-lg border bg-muted">
                        <canvas className="h-full w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background from-50% pb-[52px] pt-6">
        <div className="mx-auto max-w-3xl space-y-4 px-4">
          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 rounded-lg border bg-background p-2"
          >
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Describe the texture you want to create..."
              disabled={isLoading || isGeneratingTexture}
              className="border-0 bg-transparent focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || isGeneratingTexture}
            >
              {isLoading || isGeneratingTexture ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Send"
              )}
            </Button>
          </form>
          <div className="px-2 text-xs text-muted-foreground">
            AI will generate a texture based on your description.
          </div>
        </div>
      </div>
    </div>
  );
};
