/**
 * Global SSE Event Emitter
 * Ensures all Inngest function executions emit real-time updates
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface SSEEvent {
  chatId: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'result';
  metadata?: Record<string, unknown>;
}

/**
 * Send an SSE event to the connected client
 * This function can be called from any Inngest function
 */
export async function emitSSEEvent(event: SSEEvent): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/investigation/updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.warn(`Failed to emit SSE event: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error emitting SSE event:', error);
  }
}

/**
 * Emit a batch of SSE events
 */
export async function emitSSEBatch(events: SSEEvent[]): Promise<void> {
  await Promise.all(events.map(event => emitSSEEvent(event)));
}

/**
 * Create an SSE emitter bound to a specific chat
 */
export function createSSEEmitter(chatId: string) {
  return {
    info: (message: string, metadata?: Record<string, unknown>) =>
      emitSSEEvent({ chatId, message, type: 'info', metadata }),
    
    success: (message: string, metadata?: Record<string, unknown>) =>
      emitSSEEvent({ chatId, message, type: 'success', metadata }),
    
    error: (message: string, metadata?: Record<string, unknown>) =>
      emitSSEEvent({ chatId, message, type: 'error', metadata }),
    
    result: (message: string, metadata?: Record<string, unknown>) =>
      emitSSEEvent({ chatId, message, type: 'result', metadata }),
    
    progress: (current: number, total: number, description?: string) =>
      emitSSEEvent({
        chatId,
        message: `${description || 'Progress'}: ${current}/${total}`,
        type: 'info',
        metadata: { progress: current, total },
      }),
    
    step: (stepName: string, status: 'start' | 'complete' | 'error') => {
      const messages = {
        start: `⚙️ Starting ${stepName}...`,
        complete: `✅ Completed ${stepName}`,
        error: `❌ Error in ${stepName}`,
      };
      
      return emitSSEEvent({
        chatId,
        message: messages[status],
        type: status === 'error' ? 'error' : status === 'complete' ? 'success' : 'info',
        metadata: { step: stepName, status },
      });
    },
  };
}

/**
 * Decorator to automatically emit SSE events for function execution
 */
export function withSSELogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  chatIdExtractor: (args: Parameters<T>) => string
): T {
  return (async (...args: Parameters<T>) => {
    const chatId = chatIdExtractor(args);
    const emitter = createSSEEmitter(chatId);
    const functionName = fn.name || 'anonymous';
    
    await emitter.step(functionName, 'start');
    
    try {
      const result = await fn(...args);
      await emitter.step(functionName, 'complete');
      return result;
    } catch (error) {
      await emitter.error(`Error in ${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await emitter.step(functionName, 'error');
      throw error;
    }
  }) as T;
}