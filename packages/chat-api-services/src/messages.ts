import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { ChatAppRouter } from "@api/chat";

import { ChatApiError, ChatApiService } from "./base-service";

type AppendInput = inferRouterInputs<ChatAppRouter>["message"]["append"];
type ListInput = inferRouterInputs<ChatAppRouter>["message"]["list"];
type RawListOutput = inferRouterOutputs<ChatAppRouter>["message"]["list"];

export type MessagesAppendInput = AppendInput;
export type MessagesListInput = ListInput;
export type MessagesListOutput = RawListOutput;

export class MessagesService extends ChatApiService {
  async append(input: AppendInput): Promise<void> {
    await this.call(
      "messages.append",
      (caller) => caller.message.append(input),
      {
        fallbackMessage: "Failed to append message",
        details: {
          sessionId: input.sessionId,
          messageId: input.message.id,
        },
        recover: (error) => {
          switch (error.code) {
            case "UNAUTHORIZED":
              throw new ChatApiError({
                code: "UNAUTHORIZED",
                message: "Unauthorized: User session expired or invalid",
                cause: error,
                details: { sessionId: input.sessionId },
              });
            case "FORBIDDEN":
            case "NOT_FOUND":
              throw new ChatApiError({
                code: error.code,
                message: `Session ${input.sessionId} not found or access denied`,
                cause: error,
                details: { sessionId: input.sessionId },
              });
            default:
              throw error;
          }
        },
      },
    );
  }

  async list(input: ListInput): Promise<MessagesListOutput> {
    const messages = await this.call<RawListOutput>(
      "messages.list",
      (caller) => caller.message.list(input),
      {
        fallbackMessage: "Failed to fetch session messages",
        details: { sessionId: input.sessionId },
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
              details: { sessionId: input.sessionId },
            });
          }

          throw error;
        },
      },
    );

    return messages;
  }
}
