import type { Message, ToolSet } from "ai";
import { streamText } from "ai";
import { z } from "zod";

import { registry } from "~/providers/ai-provider";

// Define Blender Tools Schema for the backend
const blenderTools: ToolSet = {
  createBlenderObject: {
    description:
      "Creates a new object (e.g., Cube, Sphere, Suzanne) in the Blender scene.",
    parameters: z.object({
      objectType: z
        .enum(["CUBE", "SPHERE", "MONKEY"])
        .describe("The type of object to create."),
      location: z
        .object({
          x: z.number().optional().default(0).describe("X coordinate"),
          y: z.number().optional().default(0).describe("Y coordinate"),
          z: z.number().optional().default(0).describe("Z coordinate"),
        })
        .optional()
        .describe("Position to create the object."),
      name: z.string().optional().describe("Optional name for the new object."),
    }),
  },
  // Additional tools can be added here
};

// CORS headers for the desktop app
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight requests
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  const { messages } = (await request.json()) as { messages: Message[] };

  const result = streamText({
    model: registry.languageModel("openai:gpt-4-turbo-preview"),
    messages,
    maxTokens: 1000,
    temperature: 0.7,
    tools: blenderTools,
  });

  const response = result.toDataStreamResponse();

  // Add CORS headers to the response
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
