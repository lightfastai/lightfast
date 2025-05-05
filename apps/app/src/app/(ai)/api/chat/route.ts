import type { Message } from "ai";
import type { ResumableStreamContext } from "resumable-stream";
import { after } from "next/server";
import { geolocation } from "@vercel/functions";
import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  smoothStream,
  streamText,
} from "ai";
import { eq } from "drizzle-orm";
import { createResumableStreamContext } from "resumable-stream";
import { z } from "zod";

import type { Session, Stream } from "@vendor/db/lightfast/schema";
import { db } from "@vendor/db/client";
import { Workspace } from "@vendor/db/lightfast/schema";

import type { RequestHints } from "./prompts";
import type { PostRequestBody } from "./schema";
import { getTrailingMessageId } from "~/lib/utils";
import { aiTextProviders } from "~/providers/ai-provider";
import { generateTitleFromUserMessage } from "./actions";
import { systemPrompt } from "./prompts";
import {
  createStreamId,
  getMessagesBySessionId,
  getSession,
  saveMessages,
  saveSession,
} from "./queries";
import { postRequestBodySchema } from "./schema";

// Define Blender Tools Schema for the backend
const blenderTools = {
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
let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL",
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  // parse request body
  try {
    requestBody = (await request.json()) as PostRequestBody;
    requestBody = postRequestBodySchema.parse(requestBody);
  } catch (error) {
    console.error("Failed to parse request body", error);
    return new Response("Invalid JSON", { status: 400 });
  }

  const { message, sessionId, workspaceId } = requestBody;

  // ensure workspaceId exists
  try {
    const workspace = await db.query.Workspace.findFirst({
      where: eq(Workspace.id, workspaceId),
    });

    if (!workspace) {
      return new Response("Workspace not found", { status: 404 });
    }
  } catch (_) {
    return new Response("Workspace not found", { status: 404 });
  }

  // create session if it doesn't exist
  let session: Session;
  try {
    if (!sessionId) {
      const title = await generateTitleFromUserMessage({ message });

      session = await saveSession({
        workspaceId,
        title,
      });
    } else {
      session = await getSession({ sessionId });
    }
  } catch (_) {
    return new Response("Session not found", { status: 404 });
  }

  let messages: Message[];
  let requestHints: RequestHints;
  try {
    // previous messages
    const previousMessages = await getMessagesBySessionId({
      sessionId: session.id,
    });

    messages = appendClientMessage({
      // @ts-expect-error: todo add type conversion from DBMessage[] to UIMessage[]
      messages: previousMessages,
      message: message,
    });

    const { longitude, latitude, city, country } = geolocation(request);

    requestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          id: message.id,
          sessionId: session.id,
          role: "user",
          parts: message.parts,
          // attachments: message.experimental_attachments ?? [],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });
  } catch (error) {
    console.error("Failed to save messages", error);
    return new Response("Failed to save messages", { status: 500 });
  }

  let dbStream: Stream;
  try {
    dbStream = await createStreamId({ sessionId: session.id });
  } catch (error) {
    console.error("Failed to create stream", error);
    throw error;
  }

  const streamId = dbStream.id;

  const stream = createDataStream({
    execute: async (dataStream) => {
      const result = streamText({
        model: aiTextProviders.languageModel("chat-model"),
        system: systemPrompt({ requestHints }),
        messages,
        maxSteps: 5,
        tools: blenderTools,
        experimental_transform: smoothStream({ chunking: "word" }),
        onFinish: async ({ response }) => {
          try {
            const assistantId = getTrailingMessageId({
              messages: response.messages.filter(
                (message) => message.role === "assistant",
              ),
            });
            if (!assistantId) {
              throw new Error("No assistant message found");
            }

            const [, assistantMessage] = appendResponseMessages({
              messages: [message],
              responseMessages: response.messages,
            });

            if (!assistantMessage) {
              throw new Error("No assistant message found");
            }

            await saveMessages({
              messages: [
                {
                  id: assistantId,
                  sessionId: session.id,
                  role: assistantMessage.role,
                  parts: assistantMessage.parts,
                  attachments: assistantMessage.experimental_attachments ?? [],
                  createdAt: new Date(),
                },
              ],
            });
          } catch (error) {
            console.error("Failed to save chat session:", error);
          }
        },
        experimental_telemetry: {
          functionId: "stream-text",
        },
      });

      await result.consumeStream();

      result.mergeIntoDataStream(dataStream, {
        sendReasoning: true,
      });
    },
    onError: (error) => {
      console.error("Failed to stream text:", error);
      return "Failed to stream text";
    },
  });

  const streamContext = getStreamContext();

  if (streamContext) {
    return new Response(
      await streamContext.resumableStream(streamId, () => stream),
      { headers: corsHeaders },
    );
  } else {
    return new Response(stream, { headers: corsHeaders });
  }
}
