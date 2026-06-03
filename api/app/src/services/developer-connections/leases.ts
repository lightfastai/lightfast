import type { Database } from "@db/app";
import {
  issueDeveloperConnectionLease,
  listCurrentDeveloperConnections,
} from "@db/app";
import type { DeveloperConnectionIssueLeaseInput } from "@repo/developer-connection-contract";
import { TRPCError } from "@trpc/server";
import type { AuthContext } from "../../trpc";
import { materializeDeveloperCredential } from "./adapters";
import { decryptDeveloperCredential } from "./credentials";

interface DeveloperConnectionServiceContext {
  auth: AuthContext;
  db: Database;
}

export async function issueDeveloperConnectionLeases(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionIssueLeaseInput
) {
  const identity = ctx.auth.identity;
  if (identity.type !== "active") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const requested = new Set(input.providers);
  const current = await listCurrentDeveloperConnections(ctx.db, {
    clerkOrgId: identity.orgId,
  });
  const byProvider = new Map(
    current.map((connection) => [connection.provider, connection])
  );
  const issuedAt = new Date();
  const leases = [];
  const materialization = [];

  for (const provider of requested) {
    const connection = byProvider.get(provider);
    if (!connection || connection.status !== "connected") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${provider} needs reconnect`,
      });
    }
    if (!connection.enabledForSandboxes) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${provider} is disabled for sandboxes`,
      });
    }
    if (!connection.encryptedCredential) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${provider} has no credential material`,
      });
    }

    const lease = await issueDeveloperConnectionLease(ctx.db, {
      connectionId: connection.id,
      clerkOrgId: identity.orgId,
      actorUserId: identity.userId,
      sandboxRunId: input.sandboxRunId,
      workflowRunId: input.workflowRunId,
      provider,
      issuedAt,
    });
    leases.push(lease);

    const credentialPayload = await decryptDeveloperCredential<
      Record<string, unknown>
    >(connection.encryptedCredential);
    materialization.push(
      materializeDeveloperCredential({ provider, credentialPayload })
    );
  }

  return { leases, materialization };
}
