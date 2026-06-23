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
} from "@repo/api-contract";
import { ConflictError } from "../../domain/errors";
import {
  type DeveloperConnectionMaterialization,
  materializeDeveloperCredential,
} from "./adapters";
import { decryptDeveloperCredential } from "./credentials";

interface DeveloperConnectionLeaseServiceContext {
  actor: {
    userId: string;
  };
  db: Database;
  organization: {
    orgId: string;
  };
}

interface SandboxRunLeaseInput {
  sandboxRunId: string;
  workflowRunId?: string | null;
}

interface LeaseMaterializationResult {
  leases: DeveloperConnectionLease[];
  materialization: DeveloperConnectionMaterialization[];
}

function assertUsableConnection(connection: DeveloperConnection) {
  if (connection.status !== "connected") {
    throw new ConflictError(
      "DEVELOPER_CONNECTION_RECONNECT_REQUIRED",
      `${connection.provider} needs reconnect`
    );
  }
  if (!connection.encryptedCredential) {
    throw new ConflictError(
      "DEVELOPER_CONNECTION_CREDENTIAL_MISSING",
      `${connection.provider} has no credential material`
    );
  }
}

async function materializeConnection(
  connection: DeveloperConnection
): Promise<DeveloperConnectionMaterialization> {
  assertUsableConnection(connection);
  const encryptedCredential = connection.encryptedCredential;
  if (!encryptedCredential) {
    throw new ConflictError(
      "DEVELOPER_CONNECTION_CREDENTIAL_MISSING",
      `${connection.provider} has no credential material`
    );
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
  ctx: DeveloperConnectionLeaseServiceContext,
  input: DeveloperConnectionIssueLeaseInput
): Promise<LeaseMaterializationResult> {
  const requested = new Set(input.providers);
  const current = await listCurrentDeveloperConnections(ctx.db, {
    clerkOrgId: ctx.organization.orgId,
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
      throw new ConflictError(
        "DEVELOPER_CONNECTION_RECONNECT_REQUIRED",
        `${provider} needs reconnect`
      );
    }
    assertUsableConnection(connection);
    if (!connection.enabledForSandboxes) {
      throw new ConflictError(
        "DEVELOPER_CONNECTION_SANDBOX_DISABLED",
        `${provider} is disabled for sandboxes`
      );
    }

    const lease = await issueDeveloperConnectionLease(ctx.db, {
      connectionId: connection.id,
      clerkOrgId: ctx.organization.orgId,
      actorUserId: ctx.actor.userId,
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
  ctx: DeveloperConnectionLeaseServiceContext,
  input: SandboxRunLeaseInput
): Promise<LeaseMaterializationResult> {
  const current = await listCurrentDeveloperConnections(ctx.db, {
    clerkOrgId: ctx.organization.orgId,
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
      clerkOrgId: ctx.organization.orgId,
      actorUserId: ctx.actor.userId,
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
  ctx: DeveloperConnectionLeaseServiceContext,
  input: { sandboxRunId: string; now?: Date }
): Promise<LeaseMaterializationResult> {
  const now = input.now ?? new Date();
  const leases = (
    await listDeveloperConnectionLeasesForSandboxRun(ctx.db, {
      clerkOrgId: ctx.organization.orgId,
      sandboxRunId: input.sandboxRunId,
    })
  ).filter((lease) => activeLease(lease, now));
  const materialization: DeveloperConnectionMaterialization[] = [];

  for (const lease of leases) {
    const connection = await getDeveloperConnectionById(
      ctx.db,
      lease.connectionId
    );
    if (!connection || connection.clerkOrgId !== ctx.organization.orgId) {
      throw new ConflictError(
        "DEVELOPER_CONNECTION_CREDENTIAL_MISSING",
        `${lease.provider} has no credential material`
      );
    }
    materialization.push(await materializeConnection(connection));
  }

  return { leases, materialization };
}
