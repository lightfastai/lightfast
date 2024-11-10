"use client";

import type { Message as AIChatMessage } from "ai";
import { useState } from "react";
import { useChat } from "ai/react";
import { Loader2, User } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
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
  type: "user" | "idea";
  content: string;
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
  ].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="relative mx-auto flex h-full max-w-2xl flex-col py-4">
      <ScrollArea className="flex-1">
        <div className="space-y-6 pb-[200px] pt-4">
          {allMessages.map((message) => {
            if (message.type === "user") {
              return (
                <div key={message.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex flex-col gap-2 rounded-lg px-4 py-3">
                      <div className="text-sm">{message.content}</div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={message.id} className="flex gap-3">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src="/avatar-placeholder.webp"
                    alt="dahlia-ai"
                    className="rounded-[0.25rem]"
                  />
                </Avatar>

                <div className="flex-1">
                  <div className="flex-1">
                    <div className="flex max-w-full flex-col gap-2 rounded-lg px-4 py-3">
                      <div className="text-sm">{message.content}</div>
                    </div>
                  </div>

                  {(isGeneratingTexture || currentTexture) && (
                    <div className="flex w-full py-6">
                      <Card className="w-full">
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
            );
          })}
        </div>
      </ScrollArea>

      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-4 from-50% py-4">
        <form
          onSubmit={onSubmit}
          className="flex w-full items-center rounded-lg border p-2"
        >
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Describe the texture you want to create..."
            disabled={isLoading || isGeneratingTexture}
            className="border-0 focus-visible:ring-0"
          />
          <Button
            type="submit"
            variant="outline"
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
  );
};
