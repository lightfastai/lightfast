import type {
  Database,
  DeveloperConnection,
  DeveloperConnectionLease,
} from "@db/app";
import {
  getDeveloperConnectionById,
  issueDeveloperConnectionLease,
  listCurrentDeveloperConnections,
  listDeveloperConnectionLeasesForSandboxRun,
} from "@db/app";
import {
  DEVELOPER_CONNECTION_PROVIDERS,
  type DeveloperConnectionIssueLeaseInput,
} from "@repo/developer-connection-contract";
import { TRPCError } from "@trpc/server";
import type { AuthContext } from "../../trpc";
import {
  type DeveloperConnectionMaterialization,
  materializeDeveloperCredential,
} from "./adapters";
import { decryptDeveloperCredential } from "./credentials";

interface DeveloperConnectionServiceContext {
  auth: AuthContext;
  db: Database;
}

interface SandboxRunLeaseInput {
  sandboxRunId: string;
  workflowRunId?: string | null;
}

interface LeaseMaterializationResult {
  leases: DeveloperConnectionLease[];
  materialization: DeveloperConnectionMaterialization[];
}

function activeIdentity(ctx: DeveloperConnectionServiceContext) {
  const identity = ctx.auth.identity;
  if (identity.type !== "active") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return identity;
}

function assertUsableConnection(connection: DeveloperConnection) {
  if (connection.status !== "connected") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${connection.provider} needs reconnect`,
    });
  }
  if (!connection.encryptedCredential) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${connection.provider} has no credential material`,
    });
  }
}

async function materializeConnection(
  connection: DeveloperConnection
): Promise<DeveloperConnectionMaterialization> {
  assertUsableConnection(connection);
  const encryptedCredential = connection.encryptedCredential;
  if (!encryptedCredential) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${connection.provider} has no credential material`,
    });
  }
  const credentialPayload =
    await decryptDeveloperCredential<Record<string, unknown>>(
      encryptedCredential
    );
  return materializeDeveloperCredential({
    provider: connection.provider,
    credentialPayload,
  });
}

function activeLease(lease: DeveloperConnectionLease, now: Date) {
  return (
    (lease.status === "issued" || lease.status === "materialized") &&
    lease.expiresAt > now &&
    !lease.revokedAt
  );
}

export async function issueDeveloperConnectionLeases(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionIssueLeaseInput
): Promise<LeaseMaterializationResult> {
  const identity = activeIdentity(ctx);
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
    if (!connection) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${provider} needs reconnect`,
      });
    }
    assertUsableConnection(connection);
    if (!connection.enabledForSandboxes) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${provider} is disabled for sandboxes`,
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
    materialization.push(await materializeConnection(connection));
  }

  return { leases, materialization };
}

export async function issueAllEnabledDeveloperConnectionLeases(
  ctx: DeveloperConnectionServiceContext,
  input: SandboxRunLeaseInput
): Promise<LeaseMaterializationResult> {
  const identity = activeIdentity(ctx);
  const current = await listCurrentDeveloperConnections(ctx.db, {
    clerkOrgId: identity.orgId,
  });
  const byProvider = new Map(
    current.map((connection) => [connection.provider, connection])
  );
  const issuedAt = new Date();
  const leases: DeveloperConnectionLease[] = [];
  const materialization: DeveloperConnectionMaterialization[] = [];

  for (const provider of DEVELOPER_CONNECTION_PROVIDERS) {
    const connection = byProvider.get(provider);
    if (!connection?.enabledForSandboxes) {
      continue;
    }

    assertUsableConnection(connection);
    const lease = await issueDeveloperConnectionLease(ctx.db, {
      connectionId: connection.id,
      clerkOrgId: identity.orgId,
      actorUserId: identity.userId,
      sandboxRunId: input.sandboxRunId,
      workflowRunId: input.workflowRunId ?? input.sandboxRunId,
      provider,
      issuedAt,
    });
    leases.push(lease);
    materialization.push(await materializeConnection(connection));
  }

  return { leases, materialization };
}

export async function materializeDeveloperConnectionLeasesForSandboxRun(
  ctx: DeveloperConnectionServiceContext,
  input: { sandboxRunId: string; now?: Date }
): Promise<LeaseMaterializationResult> {
  const identity = activeIdentity(ctx);
  const now = input.now ?? new Date();
  const leases = (
    await listDeveloperConnectionLeasesForSandboxRun(ctx.db, {
      clerkOrgId: identity.orgId,
      sandboxRunId: input.sandboxRunId,
    })
  ).filter((lease) => activeLease(lease, now));
  const materialization: DeveloperConnectionMaterialization[] = [];

  for (const lease of leases) {
    const connection = await getDeveloperConnectionById(
      ctx.db,
      lease.connectionId
    );
    if (!connection || connection.clerkOrgId !== identity.orgId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${lease.provider} has no credential material`,
      });
    }
    materialization.push(await materializeConnection(connection));
  }

  return { leases, materialization };
}
