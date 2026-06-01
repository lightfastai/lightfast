import type { Database } from "@db/app";

import {
  createAndQueueSignal,
  type CreateAndQueueSignalInput,
} from "./create-signal";

export type SignalActor =
  | { kind: "web"; orgId: string; userId: string }
  | { apiKeyId: string; kind: "api_key"; orgId: string; userId: string }
  | {
      clientId: string;
      grantId: string;
      kind: "mcp";
      orgId: string;
      userId: string;
    };

export type SignalCreateResult = Awaited<
  ReturnType<typeof createAndQueueSignal>
>;

function apiKeyIdForActor(actor: SignalActor): string | null {
  return actor.kind === "api_key" ? actor.apiKeyId : null;
}

function mcpClientIdForActor(actor: SignalActor): string | undefined {
  return actor.kind === "mcp" ? actor.clientId : undefined;
}

function mcpGrantIdForActor(actor: SignalActor): string | undefined {
  return actor.kind === "mcp" ? actor.grantId : undefined;
}

export async function createSignalForActor(
  db: Database,
  input: {
    actor: SignalActor;
    input: string;
  }
): Promise<SignalCreateResult> {
  const signalInput: CreateAndQueueSignalInput = {
    clerkOrgId: input.actor.orgId,
    createdByApiKeyId: apiKeyIdForActor(input.actor),
    createdByMcpClientId: mcpClientIdForActor(input.actor),
    createdByMcpGrantId: mcpGrantIdForActor(input.actor),
    createdByUserId: input.actor.userId,
    input: input.input,
  };
  return createAndQueueSignal(db, signalInput);
}
