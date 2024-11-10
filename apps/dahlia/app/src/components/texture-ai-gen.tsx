"use client";

import { useState } from "react";

import { Input } from "@repo/ui/components/ui/input";

import { Texture } from "./texture/types";

type Message = {
  type: "prompt" | "idea" | "texture";
  content: string | Texture[];
};

export const TextureAIGenerator = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const generateTexture = async (idea: string) => {
    try {
      const response = await fetch("/api/chat/generate-texture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: idea, model: "gpt-4o" }),
      });

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { type: "texture", content: data.textures },
      ]);
    } catch (error) {
      console.error("Error generating texture:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      // Add user prompt to messages
      setMessages((prev) => [...prev, { type: "prompt", content: input }]);

      // Step 1: Generate the idea
      const response = await fetch("/api/chat/idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: input, model: "gpt-4o" }),
      });

      const data = await response.json();
      const idea = data.idea as string;

      // Add generated idea to messages
      setMessages((prev) => [...prev, { type: "idea", content: idea }]);

      // Step 2: Automatically generate texture from the idea
      await generateTexture(idea);

      setInput("");
    } catch (error) {
      console.error("Pipeline error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {/* Messages Display */}
      <div className="flex flex-col gap-4">
        {messages.map((message, index) => {
          if (message.type === "prompt") {
            return (
              <div
                key={index}
                className="ml-auto max-w-[80%] rounded-lg bg-primary p-4"
              >
                <p className="text-sm text-primary-foreground">
                  {message.content as string}
                </p>
              </div>
            );
          } else if (message.type === "idea") {
            return (
              <div
                key={index}
                className="mr-auto max-w-[80%] rounded-lg border bg-card p-4"
              >
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Generated Idea
                </h2>
                <p className="mt-2 text-sm">{message.content as string}</p>
              </div>
            );
          } else {
            return (
              <div
                key={index}
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
          }
        })}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="relative">
        <Input
          value={input}
          placeholder="Describe the texture you want..."
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          className="pr-12"
        />
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}
      </form>
    </div>
  );
};
