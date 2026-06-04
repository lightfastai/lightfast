import type { Database } from "@db/app";
import { createSignal, markSignalFailed } from "@db/app";
import type { CreateSignalOutput } from "@repo/api-contract";
import { Inngest } from "@vendor/inngest";
import { env as inngestEnv } from "@vendor/inngest/env";

export const SIGNAL_ENQUEUE_FAILED_ERROR_CODE = "INNGEST_ENQUEUE_FAILED";
const QUEUE_ERROR_MESSAGE = "Failed to queue signal for classification.";

export interface CreateAndQueueSignalInput {
  clerkOrgId: string;
  createdByApiKeyId: string | null;
  createdByMcpClientId?: string | null;
  createdByMcpGrantId?: string | null;
  createdByUserId: string;
  input: string;
}

interface SignalCreatedEvent {
  data: {
    clerkOrgId: string;
    signalId: string;
  };
  name: "app/signal.created";
}

export interface CreateAndQueueSignalDependencies {
  sendSignalCreatedEvent?: (event: SignalCreatedEvent) => Promise<unknown>;
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
  input: CreateAndQueueSignalInput,
  dependencies: CreateAndQueueSignalDependencies = {}
): Promise<CreateSignalOutput> {
  const mcpAttribution =
    input.createdByMcpClientId || input.createdByMcpGrantId
      ? {
          createdByMcpClientId: input.createdByMcpClientId ?? null,
          createdByMcpGrantId: input.createdByMcpGrantId ?? null,
        }
      : {};

  const signal = await createSignal(db, {
    clerkOrgId: input.clerkOrgId,
    createdByApiKeyId: input.createdByApiKeyId,
    createdByUserId: input.createdByUserId,
    input: input.input,
    ...mcpAttribution,
  });

  try {
    await (dependencies.sendSignalCreatedEvent ?? sendSignalCreatedEvent)({
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
        errorMessage: getErrorMessage(error),
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

let signalEventClient: Inngest | undefined;

function getSignalEventClient(): Inngest {
  signalEventClient ??= new Inngest({
    id: inngestEnv.INNGEST_APP_NAME,
    eventKey: inngestEnv.INNGEST_EVENT_KEY,
  });
  return signalEventClient;
}

async function sendSignalCreatedEvent(event: SignalCreatedEvent) {
  await getSignalEventClient().send(event);
}
