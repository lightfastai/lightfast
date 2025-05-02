import type { Message, ToolSet } from "ai";
import { appendResponseMessages, streamText } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@vendor/db/client";
import { Session } from "@vendor/db/lightfast/schema";

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
  const { messages, sessionId, workspaceId } = (await request.json()) as {
    messages: Message[];
    sessionId?: string;
    workspaceId?: string;
  };

  const result = streamText({
    model: registry.languageModel("openai:gpt-4-turbo-preview"),
    messages,
    maxTokens: 1000,
    temperature: 0.7,
    tools: blenderTools,
    async onFinish({ response }) {
      try {
        // Save the chat messages to the database if sessionId is provided
        if (sessionId) {
          // Update existing session
          await db
            .update(Session)
            .set({
              messages: appendResponseMessages({
                messages,
                responseMessages: response.messages,
              }),
              updatedAt: new Date(),
            })
            .where(eq(Session.id, sessionId));
        } else if (workspaceId) {
          // Create a new session with these messages
          const title = messages[0]?.content.slice(0, 100) ?? "New Chat";

          await db.insert(Session).values({
            workspaceId,
            title,
            messages: appendResponseMessages({
              messages,
              responseMessages: response.messages,
            }),
          });
        }
      } catch (error) {
        console.error("Failed to save chat session:", error);
      }
    },
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
