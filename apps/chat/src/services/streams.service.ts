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
 * TRPC service for stream operations
 */
export class StreamsService {
  /**
   * Set active stream ID for a session
   */
  async setActive({
    sessionId,
    streamId,
  }: {
    sessionId: string;
    streamId: string;
  }): Promise<void> {
    try {
      const caller = await createCaller();
      await caller.session.setActiveStream({
        sessionId,
        streamId,
      });
    } catch (error) {
      console.error('[StreamsService] Failed to set active stream:', {
        sessionId,
        streamId,
        error: isTRPCClientError(error) ? {
          code: getTRPCErrorCode(error),
          message: getTRPCErrorMessage(error)
        } : error
      });
      
      // Stream creation errors are usually not critical
      // but we should still handle auth errors
      if (isUnauthorized(error)) {
        throw new Error('Unauthorized: User session expired or invalid');
      }
      
      if (isNotFound(error) || isForbidden(error)) {
        throw new Error(`Session ${sessionId} not found or access denied`);
      }
      
      // For other errors, log but don't throw to avoid breaking the stream
      console.warn(`Failed to set active stream ${streamId} for session ${sessionId}: ${getTRPCErrorMessage(error)}`);
    }
  }

  /**
   * Get active stream ID for a session
   */
  async getActive(sessionId: string): Promise<string | null> {
    try {
      const caller = await createCaller();
      const result = await caller.session.getActiveStream({
        sessionId,
      });

      return result.activeStreamId;
    } catch (error) {
      console.error('[StreamsService] Failed to get active stream ID:', {
        sessionId,
        error: isTRPCClientError(error) ? {
          code: getTRPCErrorCode(error),
          message: getTRPCErrorMessage(error)
        } : error
      });
      
      // For read operations, return null for NOT_FOUND (session doesn't exist)
      if (isNotFound(error)) {
        console.warn(`Session ${sessionId} not found, returning null active stream`);
        return null;
      }
      
      if (isUnauthorized(error)) {
        throw new Error('Unauthorized: User session expired or invalid');
      }
      
      // For other errors, return null to be graceful
      console.warn(`Failed to get active stream for session ${sessionId}, returning null: ${getTRPCErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * Get all stream IDs for a session (returns array for compatibility)
   */
  async getAll(sessionId: string): Promise<string[]> {
    try {
      const caller = await createCaller();
      const result = await caller.session.getActiveStream({
        sessionId,
      });

      // Return array with active stream ID, or empty array if none
      return result.activeStreamId ? [result.activeStreamId] : [];
    } catch (error) {
      console.error('[StreamsService] Failed to get active stream ID:', {
        sessionId,
        error: isTRPCClientError(error) ? {
          code: getTRPCErrorCode(error),
          message: getTRPCErrorMessage(error)
        } : error
      });
      
      // For read operations, return empty array for NOT_FOUND (session doesn't exist)
      if (isNotFound(error)) {
        console.warn(`Session ${sessionId} not found, returning empty stream IDs`);
        return [];
      }
      
      if (isUnauthorized(error)) {
        throw new Error('Unauthorized: User session expired or invalid');
      }
      
      // For other errors, return empty array to be graceful
      // but log the error for debugging
      console.warn(`Failed to get active stream for session ${sessionId}, returning empty array: ${getTRPCErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Clear active stream ID for a session
   */
  async clearActive(sessionId: string): Promise<void> {
    try {
      const caller = await createCaller();
      await caller.session.clearActiveStream({
        sessionId,
      });
    } catch (error) {
      console.error('[StreamsService] Failed to clear active stream:', {
        sessionId,
        error: isTRPCClientError(error) ? {
          code: getTRPCErrorCode(error),
          message: getTRPCErrorMessage(error)
        } : error
      });
      
      if (isUnauthorized(error)) {
        throw new Error('Unauthorized: User session expired or invalid');
      }
      
      if (isNotFound(error) || isForbidden(error)) {
        throw new Error(`Session ${sessionId} not found or access denied`);
      }
      
      // For cleanup errors, just log but don't throw
      console.warn(`Failed to clear active stream for session ${sessionId}: ${getTRPCErrorMessage(error)}`);
    }
  }
}