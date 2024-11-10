"use client";

import { useState } from "react";

import { Input } from "@repo/ui/components/ui/input";

import { Texture } from "./texture/types";

export const TextureAIGenerator = () => {
  const [input, setInput] = useState("");
  const [textureData, setTextureData] = useState<Texture[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedIdea, setGeneratedIdea] = useState<string>("");

  const generateIdea = async (prompt: string) => {
    try {
      const response = await fetch("/api/chat/idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: prompt, model: "gpt-4o" }),
      });

      const data = await response.json();
      return data.idea as string;
    } catch (error) {
      console.error("Error generating idea:", error);
      throw error;
    }
  };

  const generateTexture = async (idea: string) => {
    try {
      const response = await fetch("/api/chat/generate-texture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: idea, model: "gpt-4o" }),
      });

      const data = await response.json();
      setTextureData(data.textures);
    } catch (error) {
      console.error("Error generating texture:", error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTextureData([]);
    setGeneratedIdea("");
    setIsLoading(true);

    try {
      // Step 1: Generate the idea
      const idea = await generateIdea(input);
      setGeneratedIdea(idea);

      // Step 2: Generate the texture based on the idea
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
      <form onSubmit={handleSubmit} className="relative">
        <Input
          value={input}
          placeholder="Generate a texture..."
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          className="pr-12 transition-all duration-200 ease-in-out"
        />
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}
      </form>

      {generatedIdea && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Generated Idea
          </h2>
          <p className="mt-2 text-sm">{generatedIdea}</p>
        </div>
      )}

      {textureData.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Generated Texture Data
          </h2>
          <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-sm">
            {JSON.stringify(textureData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
