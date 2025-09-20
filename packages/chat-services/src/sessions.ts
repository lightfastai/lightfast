import { createCaller } from "@repo/chat-trpc/server";
import {
  getTRPCErrorCode,
  getTRPCErrorMessage,
  isForbidden,
  isNotFound,
  isTRPCClientError,
  isUnauthorized,
} from "./errors";

export class SessionsService {
  async create({ id }: { id: string }): Promise<void> {
    try {
      const caller = await createCaller();
      await caller.session.create({ id });
    } catch (error) {
      console.error("[SessionsService] Failed to create/ensure session:", {
        sessionId: id,
        error: isTRPCClientError(error)
          ? { code: getTRPCErrorCode(error), message: getTRPCErrorMessage(error) }
          : error,
      });

      if (isUnauthorized(error)) {
        throw new Error("Unauthorized: User session expired or invalid");
      }
      if (isForbidden(error)) {
        throw new Error("Forbidden: Session belongs to another user");
      }

      throw new Error(`Failed to create session: ${getTRPCErrorMessage(error)}`);
    }
  }

  async getMetadata(sessionId: string): Promise<{ resourceId: string; id: string } | null> {
    try {
      const caller = await createCaller();
      const session = await caller.session.getMetadata({ sessionId });

      return {
        resourceId: session.clerkUserId,
        id: session.id,
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      console.error("[SessionsService] Failed to get session:", {
        sessionId,
        error: isTRPCClientError(error)
          ? { code: getTRPCErrorCode(error), message: getTRPCErrorMessage(error) }
          : error,
      });

      if (isUnauthorized(error)) {
        throw new Error("Unauthorized: User session expired or invalid");
      }
      if (isForbidden(error)) {
        throw new Error(`Session ${sessionId} access denied`);
      }

      return null;
    }
  }
}
