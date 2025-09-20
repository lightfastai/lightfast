import type {
  LightfastAppChatUIMessage,
  LightfastAppChatUIMessagePart,
} from "@repo/chat-core";
import { createCaller } from "@repo/chat-trpc/server";
import {
  getTRPCErrorCode,
  getTRPCErrorMessage,
  isForbidden,
  isNotFound,
  isTRPCClientError,
  isUnauthorized,
} from "./errors";

export class MessagesService {
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
    try {
      const caller = await createCaller();
      await caller.message.append({
        sessionId,
        message,
      });
    } catch (error) {
      console.error("[MessagesService] Failed to append message:", {
        sessionId,
        messageId: message.id,
        error: isTRPCClientError(error)
          ? { code: getTRPCErrorCode(error), message: getTRPCErrorMessage(error) }
          : error,
      });

      if (isUnauthorized(error)) {
        throw new Error("Unauthorized: User session expired or invalid");
      }
      if (isForbidden(error) || isNotFound(error)) {
        throw new Error(`Session ${sessionId} not found or access denied`);
      }

      throw new Error(`Failed to append message: ${getTRPCErrorMessage(error)}`);
    }
  }

  async list(sessionId: string): Promise<LightfastAppChatUIMessage[]> {
    try {
      const caller = await createCaller();
      const messages = await caller.message.list({ sessionId });
      return messages as LightfastAppChatUIMessage[];
    } catch (error) {
      console.error("[MessagesService] Failed to get messages:", {
        sessionId,
        error: isTRPCClientError(error)
          ? { code: getTRPCErrorCode(error), message: getTRPCErrorMessage(error) }
          : error,
      });

      if (isNotFound(error)) {
        return [];
      }
      if (isUnauthorized(error)) {
        throw new Error("Unauthorized: User session expired or invalid");
      }

      throw new Error(`Failed to get messages: ${getTRPCErrorMessage(error)}`);
    }
  }
}
