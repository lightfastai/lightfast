import type {
  LightfastAppChatUIMessage,
  LightfastAppChatUIMessagePart,
} from "@repo/chat-ai-types";

import { ChatApiError, ChatApiService } from "./base-service";

export class MessagesService extends ChatApiService {
  async append({
    sessionId,
    message,
  }: {
    sessionId: string;
    message: {
      id: string;
      role: string;
      parts: LightfastAppChatUIMessagePart[];
      modelId: string | null;
    };
  }): Promise<void> {
    await this.call(
      "messages.append",
      (caller) =>
        caller.message.append({
          sessionId,
          message,
        }),
      {
        fallbackMessage: "Failed to append message",
        details: {
          sessionId,
          messageId: message.id,
        },
        recover: (error) => {
          switch (error.code) {
            case "UNAUTHORIZED":
              throw new ChatApiError({
                code: "UNAUTHORIZED",
                message: "Unauthorized: User session expired or invalid",
                cause: error,
                details: { sessionId },
              });
            case "FORBIDDEN":
            case "NOT_FOUND":
              throw new ChatApiError({
                code: error.code,
                message: `Session ${sessionId} not found or access denied`,
                cause: error,
                details: { sessionId },
              });
            default:
              throw error;
          }
        },
      },
    );
  }

  async list(sessionId: string): Promise<LightfastAppChatUIMessage[]> {
    const messages = await this.call<LightfastAppChatUIMessage[]>(
      "messages.list",
      async (caller) =>
        (await caller.message.list({
          sessionId,
        })) as LightfastAppChatUIMessage[],
      {
        fallbackMessage: "Failed to fetch session messages",
        details: { sessionId },
        suppressCodes: ["NOT_FOUND"],
        recover: (error) => {
          if (error.code === "NOT_FOUND") {
            return [];
          }

          if (error.code === "UNAUTHORIZED") {
            throw new ChatApiError({
              code: "UNAUTHORIZED",
              message: "Unauthorized: User session expired or invalid",
              cause: error,
              details: { sessionId },
            });
          }

          throw error;
        },
      },
    );

    return messages as LightfastAppChatUIMessage[];
  }
}
