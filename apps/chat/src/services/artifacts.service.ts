import type { SaveDocumentProps } from '~/ai/artifacts/server';
import { createCaller } from '~/trpc/server';
import { 
  isTRPCClientError, 
  getTRPCErrorCode, 
  getTRPCErrorMessage,
  isForbidden,
  isUnauthorized 
} from '~/lib/trpc-errors';

/**
 * TRPC service for saving artifacts to the database
 */
export async function saveDocument({
  id,
  title,
  kind,
  content,
  sessionId,
  messageId,
}: SaveDocumentProps): Promise<void> {
  try {
    const caller = await createCaller();
    await caller.artifact.create({
      id,
      title,
      kind,
      content,
      sessionId,
      messageId,
    });
  } catch (error) {
    console.error('[ArtifactService] Failed to save document:', {
      id,
      title,
      kind,
      sessionId,
      error: isTRPCClientError(error) ? {
        code: getTRPCErrorCode(error),
        message: getTRPCErrorMessage(error)
      } : error
    });
    
    // Re-throw with descriptive error messages
    if (isUnauthorized(error)) {
      throw new Error('Unauthorized: User session expired or invalid');
    }
    if (isForbidden(error)) {
      throw new Error(`Session ${sessionId} access denied`);
    }
    
    throw new Error(`Failed to save artifact: ${getTRPCErrorMessage(error)}`);
  }
}