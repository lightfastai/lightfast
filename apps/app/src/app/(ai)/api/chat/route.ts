import type { Message, ToolSet } from "ai";
import { appendResponseMessages, streamText } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@vendor/db/client";
import { Session } from "@vendor/db/lightfast/schema";

import { registry } from "~/providers/ai-provider";

// Define Blender Tools Schema for the backend
const blenderTools: ToolSet = {
  executeBlenderCode: {
    description:
      "Executes Python code directly in Blender. This is the main way to interact with Blender - use Blender's Python API to create and manipulate objects, materials, and scenes.",
    parameters: z.object({
      code: z
        .string()
        .describe(
          "Python code to execute in Blender. Must be valid Blender Python API code.",
        ),
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
