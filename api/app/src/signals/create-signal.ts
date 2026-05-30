import type { Database } from "@db/app";
import { createSignal, markSignalFailed } from "@db/app";
import type { CreateSignalOutput } from "@repo/api-contract";

export const SIGNAL_ENQUEUE_FAILED_ERROR_CODE = "INNGEST_ENQUEUE_FAILED";
const QUEUE_ERROR_MESSAGE = "Failed to queue signal for classification.";

export interface CreateAndQueueSignalInput {
  clerkOrgId: string;
  createdByApiKeyId: string | null;
  createdByUserId: string;
  input: string;
}

export class SignalCreateQueueError extends Error {
  constructor(cause: unknown) {
    super(QUEUE_ERROR_MESSAGE, { cause });
    this.name = "SignalCreateQueueError";
  }
}

export function isSignalCreateQueueError(
  error: unknown
): error is SignalCreateQueueError {
  return error instanceof SignalCreateQueueError;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function createAndQueueSignal(
  db: Database,
  input: CreateAndQueueSignalInput
): Promise<CreateSignalOutput> {
  const signal = await createSignal(db, {
    clerkOrgId: input.clerkOrgId,
    createdByApiKeyId: input.createdByApiKeyId,
    createdByUserId: input.createdByUserId,
    input: input.input,
  });

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
    await markSignalFailed(db, {
      publicId: signal.publicId,
      clerkOrgId: signal.clerkOrgId,
      errorCode: SIGNAL_ENQUEUE_FAILED_ERROR_CODE,
      errorMessage: getErrorMessage(error),
    });
    throw new SignalCreateQueueError(error);
  }

  return {
    id: signal.publicId,
    status: "queued",
  };
}
