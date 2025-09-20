import { createCaller } from "@repo/chat-trpc/server";
import {
  getTRPCErrorCode,
  getTRPCErrorMessage,
  isForbidden,
  isNotFound,
  isTRPCClientError,
  isUnauthorized,
} from "./errors";

export class StreamsService {
  async setActive({
    sessionId,
    streamId,
  }: {
    sessionId: string;
    streamId: string;
  }): Promise<void> {
    try {
      const caller = await createCaller();
      await caller.session.setActiveStream({ sessionId, streamId });
    } catch (error) {
      console.error("[StreamsService] Failed to set active stream:", {
        sessionId,
        streamId,
        error: isTRPCClientError(error)
          ? { code: getTRPCErrorCode(error), message: getTRPCErrorMessage(error) }
          : error,
      });

      if (isUnauthorized(error)) {
        throw new Error("Unauthorized: User session expired or invalid");
      }
      if (isNotFound(error) || isForbidden(error)) {
        throw new Error(`Session ${sessionId} not found or access denied`);
      }
    }
  }

  async getActive(sessionId: string): Promise<string | null> {
    try {
      const caller = await createCaller();
      const result = await caller.session.getActiveStream({ sessionId });
      return result.activeStreamId ?? null;
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      console.error("[StreamsService] Failed to get active stream ID:", {
        sessionId,
        error: isTRPCClientError(error)
          ? { code: getTRPCErrorCode(error), message: getTRPCErrorMessage(error) }
          : error,
      });

      if (isUnauthorized(error)) {
        throw new Error("Unauthorized: User session expired or invalid");
      }

      return null;
    }
  }

  async getAll(sessionId: string): Promise<string[]> {
    try {
      const caller = await createCaller();
      const result = await caller.session.getActiveStream({ sessionId });
      return result.activeStreamId ? [result.activeStreamId] : [];
    } catch (error) {
      if (isNotFound(error)) {
        return [];
      }

      console.error("[StreamsService] Failed to get active stream ID:", {
        sessionId,
        error: isTRPCClientError(error)
          ? { code: getTRPCErrorCode(error), message: getTRPCErrorMessage(error) }
          : error,
      });

      if (isUnauthorized(error)) {
        throw new Error("Unauthorized: User session expired or invalid");
      }

      return [];
    }
  }

  async clearActive(sessionId: string): Promise<void> {
    try {
      const caller = await createCaller();
      await caller.session.clearActiveStream({ sessionId });
    } catch (error) {
      console.error("[StreamsService] Failed to clear active stream:", {
        sessionId,
        error: isTRPCClientError(error)
          ? { code: getTRPCErrorCode(error), message: getTRPCErrorMessage(error) }
          : error,
      });

      if (isUnauthorized(error)) {
        throw new Error("Unauthorized: User session expired or invalid");
      }
      if (isNotFound(error) || isForbidden(error)) {
        throw new Error(`Session ${sessionId} not found or access denied`);
      }
    }
  }
}
