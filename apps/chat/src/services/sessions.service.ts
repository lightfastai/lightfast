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
 * TRPC service for session operations
 */
export class SessionsService {
  /**
   * Create or ensure a session exists
   */
  async create({ id }: { id: string }): Promise<void> {
    try {
      const caller = await createCaller();
      await caller.session.create({ id });
    } catch (error) {
      console.error('[SessionsService] Failed to create/ensure session:', {
        sessionId: id,
        error: isTRPCClientError(error) ? {
          code: getTRPCErrorCode(error),
          message: getTRPCErrorMessage(error)
        } : error
      });
      
      // Handle specific error cases
      if (isUnauthorized(error)) {
        throw new Error('Unauthorized: User session expired or invalid');
      }
      if (isForbidden(error)) {
        throw new Error('Forbidden: Session belongs to another user');
      }
      
      throw new Error(`Failed to create session: ${getTRPCErrorMessage(error)}`);
    }
  }

  /**
   * Get session metadata by ID
   */
  async getMetadata(sessionId: string): Promise<{ resourceId: string; id: string } | null> {
    try {
      const caller = await createCaller();
      const session = await caller.session.getMetadata({
        sessionId,
      });
      
      return {
        resourceId: session.clerkUserId,
        id: session.id,
      };
    } catch (error) {
      // For read operations, return null for NOT_FOUND (session doesn't exist)
      // This is expected for new sessions that haven't been created yet
      if (isNotFound(error)) {
        // Debug log only - this is normal for new sessions
        console.debug(`[SessionsService] Session ${sessionId} not found (expected for new sessions)`);
        return null;
      }
      
      // Log actual errors
      console.error('[SessionsService] Failed to get session:', {
        sessionId,
        error: isTRPCClientError(error) ? {
          code: getTRPCErrorCode(error),
          message: getTRPCErrorMessage(error)
        } : error
      });
      
      // Handle auth errors
      if (isUnauthorized(error)) {
        throw new Error('Unauthorized: User session expired or invalid');
      }
      
      if (isForbidden(error)) {
        throw new Error(`Session ${sessionId} access denied`);
      }
      
      // For other errors, also return null to be graceful
      // but log the error for debugging
      console.warn(`Failed to get session ${sessionId}, returning null: ${getTRPCErrorMessage(error)}`);
      return null;
    }
  }
}