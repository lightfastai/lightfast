import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import type { LightfastAppChatUIMessagePart } from "~/ai/types/ui-message-types";
import { createCaller } from "~/trpc/server";
import { 
  isTRPCClientError, 
  getTRPCErrorCode, 
  getTRPCErrorMessage,
  isNotFound,
  isForbidden,
  isUnauthorized 
} from "~/lib/trpc-errors";

/**
 * TRPC service for message operations
 */
export class MessagesService {
  /**
   * Append a message to a session
   */
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
      console.error('[MessagesService] Failed to append message:', {
        sessionId,
        messageId: message.id,
        error: isTRPCClientError(error) ? {
          code: getTRPCErrorCode(error),
          message: getTRPCErrorMessage(error)
        } : error
      });
      
      // Re-throw with descriptive error messages
      if (isUnauthorized(error)) {
        throw new Error('Unauthorized: User session expired or invalid');
      }
      if (isForbidden(error) || isNotFound(error)) {
        throw new Error(`Session ${sessionId} not found or access denied`);
      }
      
      throw new Error(`Failed to append message: ${getTRPCErrorMessage(error)}`);
    }
  }

  /**
   * Get all messages for a session
   */
  async list(sessionId: string): Promise<LightfastAppChatUIMessage[]> {
    try {
      const caller = await createCaller();
      const messages = await caller.message.list({
        sessionId,
      });

      return messages as LightfastAppChatUIMessage[];
    } catch (error) {
      console.error('[MessagesService] Failed to get messages:', {
        sessionId,
        error: isTRPCClientError(error) ? {
          code: getTRPCErrorCode(error),
          message: getTRPCErrorMessage(error)
        } : error
      });
      
      // For read operations, return empty array for NOT_FOUND
      if (isNotFound(error)) {
        console.warn(`Session ${sessionId} not found, returning empty messages`);
        return [];
      }
      
      if (isUnauthorized(error)) {
        throw new Error('Unauthorized: User session expired or invalid');
      }
      
      throw new Error(`Failed to get messages: ${getTRPCErrorMessage(error)}`);
    }
  }
}