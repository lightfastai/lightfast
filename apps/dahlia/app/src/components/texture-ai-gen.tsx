"use client";

import type { Message as AIChatMessage } from "ai";
import { useState } from "react";
import { View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useChat } from "ai/react";
import { Loader2, User } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

import { NetworkEditorContext } from "~/app/(app)/(stable)/(workspace)/workspace/state/context";
import { TextureRenderPipeline } from "../app/(app)/(stable)/(workspace)/workspace/components/webgl/texture-render-pipeline";
import { TextureV2 } from "../app/(app)/(stable)/(workspace)/workspace/types/texture";

type ChatMessage = {
  id: string;
  type: "user" | "idea";
  content: string;
};

export const TextureAIGenerator = () => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isGeneratingTexture, setIsGeneratingTexture] = useState(false);
  const [currentTexture, setCurrentTexture] = useState<TextureV2 | null>(null);
  const rtarget = NetworkEditorContext.useSelector(
    (state) => state.context.rtargets[1],
  );
  console.log("rtarget", rtarget);
  const machineRef = NetworkEditorContext.useActorRef();
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

      const data = (await response.json()) as { texture: TextureV2 };
      setCurrentTexture(data.texture);

      machineRef.send({
        type: "ADD_TEXTURE",
        texture: {
          id: 1,
          x: 0,
          y: 0,
          type: "Noise",
          uniforms: data.texture.uniforms,
          input: null,
          outputs: [],
          shouldRenderInNode: true,
          inputPos: { x: 0, y: 0 },
          outputPos: { x: 0, y: 0 },
        },
      });
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
    <div className="relative mx-auto flex h-full w-full justify-center">
      <div
        className={`transition-all duration-500 ease-in-out ${
          currentTexture ? "w-1/2 border-r" : "w-full max-w-2xl"
        }`}
      >
        <ScrollArea className="h-full flex-1">
          <div className="flex flex-col justify-end">
            <div className="space-y-6 px-4 py-4">
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
                        <div className="flex w-max max-w-[75%] flex-col gap-2 rounded-lg border px-4 py-3">
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
                        className="rounded-lg"
                      />
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex-1">
                        <div className="flex max-w-full flex-col gap-2 rounded-lg px-4 py-3">
                          <div className="text-sm">{message.content}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <div className="sticky bottom-0 from-50% pt-6 backdrop-blur-sm">
          <div className="px-4 pb-[52px]">
            <form
              onSubmit={onSubmit}
              className="flex items-center gap-2 rounded-lg border p-2"
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

      {currentTexture && (
        <div className="w-1/2 p-6">
          <div className="h-full">
            <div className="space-y-6">
              <div className="aspect-square rounded-lg border bg-muted">
                <Canvas
                  shadows
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <TextureRenderPipeline />
                </Canvas>
                <View
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <mesh>
                    <planeGeometry args={[8, 8]} />
                    <meshBasicMaterial map={rtarget?.texture} />
                  </mesh>
                </View>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Status</div>
                  <div className="text-sm">
                    {isGeneratingTexture
                      ? "Processing texture pipeline..."
                      : "Texture generated successfully"}
                  </div>
                </div>
                {!isGeneratingTexture && currentTexture && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Texture Data</div>
                    <pre className="rounded-lg bg-muted p-4 text-xs">
                      {JSON.stringify(currentTexture, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
