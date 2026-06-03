import type {
  DeveloperConnectionCredentialKind,
  DeveloperConnectionProvider,
} from "@repo/developer-connection-contract";
import { and, eq, getTableColumns, inArray, isNotNull } from "drizzle-orm";
import type { Database } from "../client";
import type { DeveloperConnection, DeveloperConnectionLease } from "../schema";
import {
  orgDeveloperConnectionLeases,
  orgDeveloperConnections,
} from "../schema";
import { getRowsAffected } from "./drizzle-results";

const {
  currentOrgProviderKey: _currentOrgProviderKey,
  ...connectionSelection
} = getTableColumns(orgDeveloperConnections);

const DEFAULT_LEASE_TTL_MS = 15 * 60 * 1000;
const MAX_LEASE_TTL_MS = 30 * 60 * 1000;

export function currentDeveloperConnectionKey(
  clerkOrgId: string,
  provider: DeveloperConnectionProvider
) {
  return `${clerkOrgId}:${provider}`;
}

export async function getCurrentDeveloperConnection(
  db: Database,
  input: { clerkOrgId: string; provider: DeveloperConnectionProvider }
): Promise<DeveloperConnection | undefined> {
  const [row] = await db
    .select(connectionSelection)
    .from(orgDeveloperConnections)
    .where(
      eq(
        orgDeveloperConnections.currentOrgProviderKey,
        currentDeveloperConnectionKey(input.clerkOrgId, input.provider)
      )
    )
    .limit(1);
  return row;
}

export async function getDeveloperConnectionById(
  db: Database,
  id: number
): Promise<DeveloperConnection | undefined> {
  const [row] = await db
    .select(connectionSelection)
    .from(orgDeveloperConnections)
    .where(eq(orgDeveloperConnections.id, id))
    .limit(1);
  return row;
}

export async function listCurrentDeveloperConnections(
  db: Database,
  input: { clerkOrgId: string }
): Promise<DeveloperConnection[]> {
  return await db
    .select(connectionSelection)
    .from(orgDeveloperConnections)
    .where(
      and(
        eq(orgDeveloperConnections.clerkOrgId, input.clerkOrgId),
        isNotNull(orgDeveloperConnections.currentOrgProviderKey)
      )
    );
}

export async function replaceCurrentDeveloperConnection(
  db: Database,
  input: {
    clerkOrgId: string;
    provider: DeveloperConnectionProvider;
    providerAccountId: string | null;
    providerAccountName: string;
    credentialKind: DeveloperConnectionCredentialKind;
    credentialSchemaVersion: string;
    encryptedCredential: string;
    scopes: string[];
    metadata: Record<string, unknown>;
    expiresAt: Date | null;
    actorUserId: string;
    verifiedAt: Date;
  }
): Promise<DeveloperConnection> {
  return await db.transaction(async (tx) => {
    const current = await getCurrentDeveloperConnection(tx, input);
    const now = new Date();

    if (current) {
      const result = await tx
        .update(orgDeveloperConnections)
        .set({
          currentOrgProviderKey: null,
          encryptedCredential: null,
          status: "replaced",
          revokedAt: now,
          updatedAt: now,
          updatedByUserId: input.actorUserId,
        })
        .where(eq(orgDeveloperConnections.id, current.id));

      if (getRowsAffected(result) === 0) {
        throw new Error(`Failed to replace developer connection ${current.id}`);
      }
    }

    const [inserted] = await tx
      .insert(orgDeveloperConnections)
      .values({
        clerkOrgId: input.clerkOrgId,
        currentOrgProviderKey: currentDeveloperConnectionKey(
          input.clerkOrgId,
          input.provider
        ),
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        providerAccountName: input.providerAccountName,
        status: "connected",
        enabledForSandboxes: true,
        credentialKind: input.credentialKind,
        credentialSchemaVersion: input.credentialSchemaVersion,
        encryptedCredential: input.encryptedCredential,
        scopes: input.scopes,
        metadata: input.metadata,
        expiresAt: input.expiresAt,
        lastVerifiedAt: input.verifiedAt,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
      })
      .$returningId();

    if (!inserted?.id) {
      throw new Error("Failed to insert developer connection");
    }

    const row = await getDeveloperConnectionById(tx, inserted.id);
    if (!row) {
      throw new Error("Failed to load inserted developer connection");
    }
    return row;
  });
}

export async function setCurrentDeveloperConnectionSandboxEnabled(
  db: Database,
  input: {
    clerkOrgId: string;
    provider: DeveloperConnectionProvider;
    enabled: boolean;
    actorUserId: string;
  }
): Promise<DeveloperConnection | undefined> {
  const current = await getCurrentDeveloperConnection(db, input);
  if (!current) {
    return;
  }

  const result = await db
    .update(orgDeveloperConnections)
    .set({
      enabledForSandboxes: input.enabled,
      updatedAt: new Date(),
      updatedByUserId: input.actorUserId,
    })
    .where(eq(orgDeveloperConnections.id, current.id));

  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperConnectionById(db, current.id);
}

export async function markCurrentDeveloperConnectionNeedsReconnect(
  db: Database,
  input: { clerkOrgId: string; provider: DeveloperConnectionProvider }
): Promise<DeveloperConnection | undefined> {
  const current = await getCurrentDeveloperConnection(db, input);
  if (!current) {
    return;
  }

  const result = await db
    .update(orgDeveloperConnections)
    .set({
      status: "needs_reconnect",
      updatedAt: new Date(),
    })
    .where(eq(orgDeveloperConnections.id, current.id));

  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperConnectionById(db, current.id);
}

export async function revokeCurrentDeveloperConnection(
  db: Database,
  input: {
    clerkOrgId: string;
    provider: DeveloperConnectionProvider;
    actorUserId: string;
  }
): Promise<DeveloperConnection | undefined> {
  const current = await getCurrentDeveloperConnection(db, input);
  if (!current) {
    return;
  }

  const now = new Date();
  const result = await db
    .update(orgDeveloperConnections)
    .set({
      currentOrgProviderKey: null,
      encryptedCredential: null,
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
      updatedByUserId: input.actorUserId,
    })
    .where(eq(orgDeveloperConnections.id, current.id));

  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperConnectionById(db, current.id);
}

export function developerConnectionLeaseExpiresAt(
  now: Date,
  requestedTtlMs = DEFAULT_LEASE_TTL_MS
) {
  const ttlMs = Math.min(requestedTtlMs, MAX_LEASE_TTL_MS);
  return new Date(now.getTime() + ttlMs);
}

export async function issueDeveloperConnectionLease(
  db: Database,
  input: {
    connectionId: number;
    clerkOrgId: string;
    actorUserId: string;
    sandboxRunId: string;
    workflowRunId: string;
    provider: DeveloperConnectionProvider;
    issuedAt: Date;
    requestedTtlMs?: number;
  }
): Promise<DeveloperConnectionLease> {
  return await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(orgDeveloperConnectionLeases)
      .values({
        connectionId: input.connectionId,
        clerkOrgId: input.clerkOrgId,
        actorUserId: input.actorUserId,
        sandboxRunId: input.sandboxRunId,
        workflowRunId: input.workflowRunId,
        provider: input.provider,
        status: "issued",
        issuedAt: input.issuedAt,
        expiresAt: developerConnectionLeaseExpiresAt(
          input.issuedAt,
          input.requestedTtlMs
        ),
      })
      .$returningId();

    if (!inserted?.id) {
      throw new Error("Failed to insert developer connection lease");
    }

    await tx
      .update(orgDeveloperConnections)
      .set({
        lastUsedAt: input.issuedAt,
        lastUsedByUserId: input.actorUserId,
        updatedAt: input.issuedAt,
      })
      .where(eq(orgDeveloperConnections.id, input.connectionId));

    const lease = await getDeveloperConnectionLeaseById(tx, inserted.id);
    if (!lease) {
      throw new Error("Failed to load inserted developer connection lease");
    }
    return lease;
  });
}

export async function getDeveloperConnectionLeaseById(
  db: Database,
  id: number
): Promise<DeveloperConnectionLease | undefined> {
  const [row] = await db
    .select()
    .from(orgDeveloperConnectionLeases)
    .where(eq(orgDeveloperConnectionLeases.id, id))
    .limit(1);
  return row;
}

export async function revokeDeveloperConnectionLease(
  db: Database,
  input: { leaseId: number; revokedAt: Date }
): Promise<DeveloperConnectionLease | undefined> {
  const result = await db
    .update(orgDeveloperConnectionLeases)
    .set({
      status: "revoked",
      revokedAt: input.revokedAt,
      updatedAt: input.revokedAt,
    })
    .where(eq(orgDeveloperConnectionLeases.id, input.leaseId));

  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperConnectionLeaseById(db, input.leaseId);
}

export async function listDeveloperConnectionLeasesForSandboxRun(
  db: Database,
  input: { clerkOrgId: string; sandboxRunId: string }
): Promise<DeveloperConnectionLease[]> {
  return await db
    .select()
    .from(orgDeveloperConnectionLeases)
    .where(
      and(
        eq(orgDeveloperConnectionLeases.clerkOrgId, input.clerkOrgId),
        eq(orgDeveloperConnectionLeases.sandboxRunId, input.sandboxRunId)
      )
    );
}

export async function markDeveloperConnectionLeaseMaterialized(
  db: Database,
  input: { leaseId: number; materializedAt: Date }
): Promise<DeveloperConnectionLease | undefined> {
  const result = await db
    .update(orgDeveloperConnectionLeases)
    .set({
      status: "materialized",
      materializedAt: input.materializedAt,
      updatedAt: input.materializedAt,
    })
    .where(eq(orgDeveloperConnectionLeases.id, input.leaseId));

  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperConnectionLeaseById(db, input.leaseId);
}

export async function revokeDeveloperConnectionLeasesForSandboxRun(
  db: Database,
  input: { clerkOrgId: string; sandboxRunId: string; revokedAt: Date }
): Promise<DeveloperConnectionLease[]> {
  await db
    .update(orgDeveloperConnectionLeases)
    .set({
      status: "revoked",
      revokedAt: input.revokedAt,
      updatedAt: input.revokedAt,
    })
    .where(
      and(
        eq(orgDeveloperConnectionLeases.clerkOrgId, input.clerkOrgId),
        eq(orgDeveloperConnectionLeases.sandboxRunId, input.sandboxRunId),
        inArray(orgDeveloperConnectionLeases.status, ["issued", "materialized"])
      )
    );

  return await listDeveloperConnectionLeasesForSandboxRun(db, input);
}
