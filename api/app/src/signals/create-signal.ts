import { createSignal, type Database, markSignalFailed } from "@db/app";
import type { CreateSignalOutput } from "@repo/api-contract";

export const SIGNAL_ENQUEUE_FAILED_ERROR_CODE = "INNGEST_ENQUEUE_FAILED";

export class SignalCreateQueueError extends Error {
  constructor(cause: unknown) {
    super("Failed to queue signal for classification.", { cause });
    this.name = "SignalCreateQueueError";
  }
}

export function isSignalCreateQueueError(
  error: unknown
): error is SignalCreateQueueError {
  return error instanceof SignalCreateQueueError;
}

export async function createAndQueueSignal(
  db: Database,
  input: Parameters<typeof createSignal>[1]
): Promise<CreateSignalOutput> {
  const signal = await createSignal(db, input);

  try {
    const { inngest } = await import("../inngest/client");
    await inngest.send({
      name: "app/signal.created",
      data: {
        clerkOrgId: signal.clerkOrgId,
        signalId: signal.publicId,
      },
    });
  } catch (error) {
    try {
      await markSignalFailed(db, {
        publicId: signal.publicId,
        clerkOrgId: signal.clerkOrgId,
        errorCode: SIGNAL_ENQUEUE_FAILED_ERROR_CODE,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } catch {
      // Preserve the queueing failure as the primary error for API translation.
    }
    throw new SignalCreateQueueError(error);
  }

  return {
    id: signal.publicId,
    status: "queued",
    visibilityScope: "user",
  };
}
