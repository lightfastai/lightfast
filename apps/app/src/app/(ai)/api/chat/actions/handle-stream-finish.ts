import type { Message } from "ai";

import { nanoid } from "@repo/lib";

import { saveMessages } from "./save-messages";

interface HandleStreamFinishParams {
  responseMessages: Message[];
  sessionId: string;
}

export async function handleStreamFinish({
  responseMessages,
  sessionId,
}: HandleStreamFinishParams) {
  try {
    // Create the message to save
    const generatedMessages = [
      ...responseMessages.slice(0, -1),
      ...responseMessages.slice(-1),
    ];

    // Save chat with complete response and related questions
    await saveMessages({
      messages: generatedMessages.map((message) => ({
        sessionId,
        createdAt: new Date(),
        updatedAt: new Date(),
        id: nanoid(),
        parts: message.content,
        attachments: [],
        role: message.role,
        content: message.content,
      })),
    }).catch((error) => {
      console.error("Failed to save chat:", error);
      throw new Error("Failed to save chat history");
    });
  } catch (error) {
    console.error("Error in handleStreamFinish:", error);
    throw error;
  }
}
