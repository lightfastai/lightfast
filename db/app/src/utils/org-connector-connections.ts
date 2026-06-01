import type {
  ConnectableConnectorProvider,
  FullConnectorToolManifest,
} from "@repo/connector-contract";
import { and, eq, getTableColumns, isNotNull } from "drizzle-orm";
import type { Database } from "../client";
import type { OrgConnectorConnection } from "../schema";
import { orgConnectorConnections } from "../schema";
import { getRowsAffected, isDuplicateKeyError } from "./drizzle-results";

const {
  currentOrgProviderKey: _currentOrgProviderKey,
  ...connectionSelection
} = getTableColumns(orgConnectorConnections);

export function currentOrgProviderKey(
  clerkOrgId: string,
  provider: ConnectableConnectorProvider
) {
  return `${clerkOrgId}:${provider}`;
}

export interface GetCurrentOrgConnectorConnectionInput {
  clerkOrgId: string;
  provider: ConnectableConnectorProvider;
}

export async function getCurrentOrgConnectorConnection(
  db: Database,
  input: GetCurrentOrgConnectorConnectionInput
): Promise<OrgConnectorConnection | undefined> {
  const [row] = await db
    .select(connectionSelection)
    .from(orgConnectorConnections)
    .where(
      eq(
        orgConnectorConnections.currentOrgProviderKey,
        currentOrgProviderKey(input.clerkOrgId, input.provider)
      )
    )
    .limit(1);
  return row;
}

export async function listCurrentOrgConnectorConnections(
  db: Database,
  input: { clerkOrgId: string }
): Promise<OrgConnectorConnection[]> {
  return await db
    .select(connectionSelection)
    .from(orgConnectorConnections)
    .where(
      and(
        eq(orgConnectorConnections.clerkOrgId, input.clerkOrgId),
        isNotNull(orgConnectorConnections.currentOrgProviderKey)
      )
    );
}

export interface FinalizeCurrentOrgConnectorConnectionInput {
  accessTokenExpiresAt: Date | null;
  clerkOrgId: string;
  connectedByUserId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  mcpEndpoint: string;
  metadata: Record<string, unknown>;
  provider: ConnectableConnectorProvider;
  providerActorId: string | null;
  providerActorName: string | null;
  providerWorkspaceId: string | null;
  providerWorkspaceName: string | null;
  refreshTokenExpiresAt: Date | null;
  scopes: string[];
  toolManifest: FullConnectorToolManifest;
}

export async function finalizeCurrentOrgConnectorConnection(
  db: Database,
  input: FinalizeCurrentOrgConnectorConnectionInput
): Promise<OrgConnectorConnection> {
  let duplicateError: unknown;
  const inserted = await db
    .transaction(async (tx) => {
      const current = await getCurrentOrgConnectorConnection(tx, input);
      const now = new Date();

      if (current) {
        const result = await tx
          .update(orgConnectorConnections)
          .set(revokedConnectorConnectionValues(now))
          .where(
            and(
              eq(orgConnectorConnections.id, current.id),
              eq(orgConnectorConnections.status, current.status)
            )
          );

        if (getRowsAffected(result) === 0) {
          throw new Error(
            `Failed to revoke current connector connection ${current.id}`
          );
        }
      }

      const [row] = await tx
        .insert(orgConnectorConnections)
        .values({
          accessTokenExpiresAt: input.accessTokenExpiresAt,
          clerkOrgId: input.clerkOrgId,
          connectedByUserId: input.connectedByUserId,
          currentOrgProviderKey: currentOrgProviderKey(
            input.clerkOrgId,
            input.provider
          ),
          encryptedAccessToken: input.encryptedAccessToken,
          encryptedRefreshToken: input.encryptedRefreshToken,
          mcpEndpoint: input.mcpEndpoint,
          metadata: input.metadata,
          provider: input.provider,
          providerActorId: input.providerActorId,
          providerActorName: input.providerActorName,
          providerWorkspaceId: input.providerWorkspaceId,
          providerWorkspaceName: input.providerWorkspaceName,
          refreshTokenExpiresAt: input.refreshTokenExpiresAt,
          revokedAt: null,
          scopes: input.scopes,
          status: "active",
          toolManifest: input.toolManifest,
        })
        .$returningId();

      if (!row?.id) {
        throw new Error(
          `Failed to insert connector connection for org ${input.clerkOrgId}`
        );
      }

      const insertedConnection = await getOrgConnectorConnectionById(tx, row.id);
      if (!insertedConnection) {
        throw new Error(
          `Failed to insert connector connection for org ${input.clerkOrgId}`
        );
      }
      return insertedConnection;
    })
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      duplicateError = error;
      return undefined;
    });

  if (duplicateError) {
    return await recoverOrgConnectorConnectionRace(db, input, duplicateError);
  }

  if (!inserted) {
    throw new Error(
      `Failed to insert connector connection for org ${input.clerkOrgId}`
    );
  }
  return inserted;
}

export async function markCurrentOrgConnectorConnectionRevoked(
  db: Database,
  input: GetCurrentOrgConnectorConnectionInput
): Promise<OrgConnectorConnection | undefined> {
  const current = await getCurrentOrgConnectorConnection(db, input);
  if (!current) {
    return;
  }

  const result = await db
    .update(orgConnectorConnections)
    .set(revokedConnectorConnectionValues(new Date()))
    .where(
      and(
        eq(orgConnectorConnections.id, current.id),
        eq(orgConnectorConnections.status, current.status)
      )
    );

  if (getRowsAffected(result) === 0) {
    return;
  }

  return await getOrgConnectorConnectionById(db, current.id);
}

export async function markCurrentOrgConnectorConnectionError(
  db: Database,
  input: GetCurrentOrgConnectorConnectionInput
): Promise<OrgConnectorConnection | undefined> {
  const current = await getCurrentOrgConnectorConnection(db, input);
  if (!current) {
    return;
  }

  const result = await db
    .update(orgConnectorConnections)
    .set({
      enabledForAutomations: false,
      status: "error",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orgConnectorConnections.id, current.id),
        eq(orgConnectorConnections.status, current.status)
      )
    );

  if (getRowsAffected(result) === 0) {
    return;
  }

  return await getOrgConnectorConnectionById(db, current.id);
}

export interface UpdateConnectorToolManifestInput
  extends GetCurrentOrgConnectorConnectionInput {
  lastToolRefreshAt: Date;
  toolManifest: FullConnectorToolManifest;
}

export async function updateConnectorToolManifest(
  db: Database,
  input: UpdateConnectorToolManifestInput
): Promise<boolean> {
  const result = await db
    .update(orgConnectorConnections)
    .set({
      lastToolRefreshAt: input.lastToolRefreshAt,
      lastToolRefreshErrorAt: null,
      lastToolRefreshErrorCode: null,
      toolManifest: input.toolManifest,
      updatedAt: input.lastToolRefreshAt,
    })
    .where(currentConnectorWhere(input));

  return getRowsAffected(result) > 0;
}

export interface RecordConnectorToolRefreshErrorInput
  extends GetCurrentOrgConnectorConnectionInput {
  lastToolRefreshErrorAt: Date;
  lastToolRefreshErrorCode: string;
}

export async function recordConnectorToolRefreshError(
  db: Database,
  input: RecordConnectorToolRefreshErrorInput
): Promise<boolean> {
  const result = await db
    .update(orgConnectorConnections)
    .set({
      lastToolRefreshErrorAt: input.lastToolRefreshErrorAt,
      lastToolRefreshErrorCode: input.lastToolRefreshErrorCode,
      updatedAt: input.lastToolRefreshErrorAt,
    })
    .where(currentConnectorWhere(input));

  return getRowsAffected(result) > 0;
}

export async function setConnectorAutomationEnabled(
  db: Database,
  input: GetCurrentOrgConnectorConnectionInput & { enabled: boolean }
): Promise<boolean> {
  const result = await db
    .update(orgConnectorConnections)
    .set({
      enabledForAutomations: input.enabled,
      updatedAt: new Date(),
    })
    .where(currentConnectorWhere(input));

  return getRowsAffected(result) > 0;
}

export interface UpdateObservedConnectorTokensInput {
  accessTokenExpiresAt: Date | null;
  clerkOrgId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  id: number;
  observedEncryptedRefreshToken: string;
  refreshTokenExpiresAt: Date | null;
  updatedAt: Date;
}

export async function updateObservedConnectorTokens(
  db: Database,
  input: UpdateObservedConnectorTokensInput
): Promise<boolean> {
  const result = await db
    .update(orgConnectorConnections)
    .set({
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken,
      refreshTokenExpiresAt: input.refreshTokenExpiresAt,
      updatedAt: input.updatedAt,
    })
    .where(
      and(
        eq(orgConnectorConnections.id, input.id),
        eq(orgConnectorConnections.clerkOrgId, input.clerkOrgId),
        eq(
          orgConnectorConnections.encryptedRefreshToken,
          input.observedEncryptedRefreshToken
        ),
        eq(orgConnectorConnections.status, "active")
      )
    );

  return getRowsAffected(result) > 0;
}

async function getOrgConnectorConnectionById(
  db: Database,
  id: number
): Promise<OrgConnectorConnection | undefined> {
  const [row] = await db
    .select(connectionSelection)
    .from(orgConnectorConnections)
    .where(eq(orgConnectorConnections.id, id))
    .limit(1);
  return row;
}

async function recoverOrgConnectorConnectionRace(
  db: Database,
  input: GetCurrentOrgConnectorConnectionInput,
  fallbackError: unknown
): Promise<OrgConnectorConnection> {
  const current = await getCurrentOrgConnectorConnection(db, input);
  if (current) {
    return current;
  }
  throw fallbackError;
}

function currentConnectorWhere(input: GetCurrentOrgConnectorConnectionInput) {
  return eq(
    orgConnectorConnections.currentOrgProviderKey,
    currentOrgProviderKey(input.clerkOrgId, input.provider)
  );
}

function revokedConnectorConnectionValues(now: Date) {
  return {
    accessTokenExpiresAt: null,
    currentOrgProviderKey: null,
    encryptedAccessToken: null,
    encryptedRefreshToken: null,
    enabledForAutomations: false,
    refreshTokenExpiresAt: null,
    revokedAt: now,
    status: "revoked" as const,
    toolManifest: [],
    updatedAt: now,
  };
}
