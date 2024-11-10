"use client";

import { useState } from "react";

import { Input } from "@repo/ui/components/ui/input";

import { Texture } from "./texture/types";

export const TextureAIGenerator = () => {
  const [input, setInput] = useState("");
  const [textureData, setTextureData] = useState<Texture[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTextureData([]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/generate-texture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: input, model: "gpt-4o" }),
      });

      const data = (await response.json()) as { textures: Texture[] };
      console.log(data);
      // setGeometryData(data.geometries);
      setInput("");
    } catch (error) {
      console.error("Error:", error);
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
    </div>
  );
};
