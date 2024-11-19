import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { $TextureSystemJsonSchema } from "@repo/webgl";

import { $TextureV2 } from "~/app/(app)/(stable)/(workspace)/workspace/types/texture.schema";

export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  const { messages, model } = (await req.json()) as {
    messages: string;
    model: string;
  };

  if (!model) {
    return new Response("Model is required", { status: 400 });
  }

  let modelToUse;
  if (model === "gpt-4o") {
    modelToUse = openai(model);
  } else {
    modelToUse = anthropic(model);
  }

  const response = await generateObject({
    model: modelToUse,
    schema: z.object({
      texture: $TextureV2,
    }),
    system:
      "You are an intelligent texture creator bot that loves creating textures for 3D objects using ThreeJS. " +
      "Given the idea provided, use the texture json schema create render target pipeline texture data." +
      "Think thoroughly about the provided idea and create the best possible textures.",
    messages: [
      {
        role: "system",
        content: JSON.stringify($TextureSystemJsonSchema),
      },
      {
        role: "user",
        content: messages,
      },
    ],
  });

  return new Response(JSON.stringify(response.object), {
    headers: { "Content-Type": "application/json" },
  });
}
