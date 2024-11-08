import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { $Geometries } from "../../components/schema";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  const { messages, model } = (await req.json()) as {
    messages: string[];
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
    output: "object",
    schema: z.object({
      geometries: $Geometries,
    }),
    system:
      "You are an intelligent geometry creator bot that loves creating 3D Geometry using ThreeJS. " +
      "Given the conversation between you and the user, use the provided skills and world functions to write ThreeJS Geometry data." +
      "Think thoroughly about the user's request and the context of the conversation to create the best possible geometries." +
      "Strictly follow the schema provided. ",
    messages: [
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
