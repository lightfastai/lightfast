"use client";

import { useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";

import type { Geometry } from "./types";
import { CENTER_OF_WORLD, WORLD_CAMERA_POSITION_FAR } from "./constants";
import { GeometryViewer } from "./r3f/geometry-viewer";

export const GeometryAIGenerator = () => {
  const [input, setInput] = useState("");
  const [geometryData, setGeometryData] = useState<Geometry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeometryData([]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/generate-geometry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: input, model: "gpt-4o" }),
      });

      const data = (await response.json()) as { geometries: Geometry[] };
      setGeometryData(data.geometries);
      setInput("");
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-sm uppercase">Scene</CardTitle>
        </CardHeader>
        <CardContent className="aspect-square p-0">
          <GeometryViewer
            geometries={geometryData}
            cameraPosition={WORLD_CAMERA_POSITION_FAR}
            lookAt={CENTER_OF_WORLD}
            shouldRenderGrid={true}
            shouldRenderAxes={true}
            shouldRender={true}
          />
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="relative">
        <Input
          value={input}
          placeholder="Generate a geometry..."
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
