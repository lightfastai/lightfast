import type { Message } from "ai";
import { geolocation } from "@vercel/functions";
import { appendClientMessage } from "ai";

import type { Session, Stream } from "@vendor/db/lightfast/schema";

import type { RequestHints } from "./prompts";
import type { PostRequestBody } from "./schema";
import { createStreamId } from "./actions/create-stream-id";
import { generateTitleFromUserMessage } from "./actions/generate-title-from-user-message";
import { getMessagesBySessionId } from "./actions/get-messages-by-session-id";
import { saveMessages } from "./actions/save-messages";
import { saveSession } from "./actions/save-session";
import { createToolCallingStreamResponse } from "./streaming/create-tool-calling-stream";
import { getStreamContext } from "./utils/get-stream-context";

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  // parse request body
  try {
    requestBody = (await request.json()) as PostRequestBody;
  } catch (error) {
    console.error("Failed to parse request body", error);
    return new Response("Invalid JSON", { status: 400 });
  }

  const { message, sessionId, id: userMessageId, sessionMode } = requestBody;

  console.log("chat request", {
    message,
    sessionId,
    userMessageId,
    sessionMode,
  });

  let session: Session;
  try {
    const title = await generateTitleFromUserMessage({ message });
    session = await saveSession({
      id: sessionId,
      title,
    });
  } catch (error) {
    console.error("Failed to save session", error);
    return new Response("Failed to save session", { status: 500 });
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
          attachments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
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

  const stream = createToolCallingStreamResponse({
    messages,
    sessionId: session.id,
    userMessage: message,
    sessionMode,
  });

  const streamContext = getStreamContext();

  if (streamContext) {
    return new Response(
      await streamContext.resumableStream(streamId, () => stream),
    );
  } else {
    return new Response(stream);
  }
}
