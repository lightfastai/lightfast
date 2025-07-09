/**
 * SSE Event Helpers for Inngest Functions
 * Ensures all operations emit real-time updates
 */

interface SSEStepOptions {
  chatId: string;
  step: any;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Wraps any async operation with SSE event emission
 */
export async function withSSETracking<T>(
  options: SSEStepOptions,
  operation: () => Promise<T>
): Promise<T> {
  const { chatId, step, description, metadata } = options;
  const operationName = description || 'Operation';
  
  try {
    // Emit start event
    await step.sendEvent('sse-op-start', {
      name: 'investigation/update',
      data: {
        chatId,
        message: `🔄 ${operationName} started...`,
        type: 'info',
        metadata: {
          ...metadata,
          status: 'started',
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Execute operation
    const result = await operation();

    // Emit success event
    await step.sendEvent('sse-op-success', {
      name: 'investigation/update',
      data: {
        chatId,
        message: `✅ ${operationName} completed successfully`,
        type: 'success',
        metadata: {
          ...metadata,
          status: 'completed',
          timestamp: new Date().toISOString(),
        },
      },
    });

    return result;
  } catch (error) {
    // Emit error event
    await step.sendEvent('sse-op-error', {
      name: 'investigation/update',
      data: {
        chatId,
        message: `❌ ${operationName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
        metadata: {
          ...metadata,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      },
    });

    throw error;
  }
}

/**
 * Emit progress updates during long operations
 */
export async function emitProgress(
  options: SSEStepOptions & { progress: number; total?: number }
): Promise<void> {
  const { chatId, step, description, progress, total, metadata } = options;
  const progressText = total ? `${progress}/${total}` : `${progress}%`;
  
  await step.sendEvent('sse-progress', {
    name: 'investigation/update',
    data: {
      chatId,
      message: `📊 ${description || 'Progress'}: ${progressText}`,
      type: 'info',
      metadata: {
        ...metadata,
        progress,
        total,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

/**
 * Emit detailed logs for debugging
 */
export async function emitLog(
  options: SSEStepOptions & { level: 'info' | 'warn' | 'error'; message: string }
): Promise<void> {
  const { chatId, step, level, message, metadata } = options;
  const icons = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };
  
  await step.sendEvent('sse-log', {
    name: 'investigation/update',
    data: {
      chatId,
      message: `${icons[level]} ${message}`,
      type: level === 'error' ? 'error' : 'info',
      metadata: {
        ...metadata,
        logLevel: level,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

/**
 * Batch emit multiple status updates
 */
export async function emitBatchUpdates(
  options: SSEStepOptions & { updates: Array<{ message: string; type?: 'info' | 'success' | 'error' }> }
): Promise<void> {
  const { chatId, step, updates, metadata } = options;
  
  for (const update of updates) {
    await step.sendEvent('sse-batch-update', {
      name: 'investigation/update',
      data: {
        chatId,
        message: update.message,
        type: update.type || 'info',
        metadata: {
          ...metadata,
          batch: true,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
}

/**
 * Create a tracked step that automatically emits SSE events
 */
export function createTrackedStep(step: any, chatId: string) {
  return {
    run: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      return withSSETracking(
        {
          chatId,
          step,
          description: name.replace(/-/g, ' '),
          metadata: { stepName: name },
        },
        async () => step.run(name, fn)
      );
    },

    sendEvent: async (name: string, payload: any) => {
      // Log the event being sent
      await emitLog({
        chatId,
        step,
        level: 'info',
        message: `Sending event: ${payload.name}`,
        metadata: { eventName: name },
      });

      return step.sendEvent(name, payload);
    },

    sleep: async (name: string, duration: number) => {
      await emitLog({
        chatId,
        step,
        level: 'info',
        message: `Waiting ${duration}ms...`,
        metadata: { sleepName: name, duration },
      });

      return step.sleep(name, duration);
    },
  };
}