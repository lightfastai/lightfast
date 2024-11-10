import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { $TextureSystemJsonSchema } from "@repo/webgl";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  const { messages, model } = (await req.json()) as {
    messages: string[];
    model: string;
  };

  console.log(JSON.stringify($TextureSystemJsonSchema));

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
      idea: z.string(),
    }),
    messages: [
      {
        role: "system",
        content:
          "You are an intelligent texture creator bot that loves creating textures for 3D objects using ThreeJS. " +
          "Given the conversation between you and the user, use the texture json schema create render target pipeline texture data." +
          "Think thoroughly about the user's request and the context of the conversation to create the best possible textures. " +
          "Your response should be a single idea for a texture that the user can use to create a 3D object.",
      },
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
