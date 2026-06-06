import type {
  FullConnectorToolManifest,
  UserConnectorProvider,
} from "@repo/connector-contract";
import { and, eq, getTableColumns, isNotNull, isNull } from "drizzle-orm";
import type { Database } from "../client";
import type { UserConnectorConnection } from "../schema";
import { userConnectorConnections } from "../schema";
import { getRowsAffected } from "./drizzle-results";

const {
  currentUserProviderKey: _currentUserProviderKey,
  ...connectionSelection
} = getTableColumns(userConnectorConnections);

export function currentUserProviderKey(
  clerkUserId: string,
  provider: UserConnectorProvider
) {
  return `${clerkUserId}:${provider}`;
}

export interface GetCurrentUserConnectorConnectionInput {
  clerkUserId: string;
  provider: UserConnectorProvider;
}

export interface ObservedCurrentUserConnectorConnectionInput
  extends GetCurrentUserConnectorConnectionInput {
  observedCurrentConnectionId?: number | null;
  observedEncryptedAccessToken?: string | null;
  observedEncryptedRefreshToken?: string | null;
}

export async function getCurrentUserConnectorConnection(
  db: Database,
  input: GetCurrentUserConnectorConnectionInput
): Promise<UserConnectorConnection | undefined> {
  const [row] = await db
    .select(connectionSelection)
    .from(userConnectorConnections)
    .where(
      eq(
        userConnectorConnections.currentUserProviderKey,
        currentUserProviderKey(input.clerkUserId, input.provider)
      )
    )
    .limit(1);
  return row;
}

export async function listCurrentUserConnectorConnections(
  db: Database,
  input: { clerkUserId: string }
): Promise<UserConnectorConnection[]> {
  return await db
    .select(connectionSelection)
    .from(userConnectorConnections)
    .where(
      and(
        eq(userConnectorConnections.clerkUserId, input.clerkUserId),
        isNotNull(userConnectorConnections.currentUserProviderKey)
      )
    );
}

export interface FinalizeCurrentUserConnectorConnectionInput {
  accessTokenExpiresAt: Date | null;
  clerkUserId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  lastToolRefreshAt?: Date | null;
  lastToolRefreshErrorAt?: Date | null;
  lastToolRefreshErrorCode?: string | null;
  mcpEndpoint: string;
  metadata: Record<string, unknown>;
  observedCurrentConnectionId?: number | null;
  observedEncryptedAccessToken?: string | null;
  observedEncryptedRefreshToken?: string | null;
  provider: UserConnectorProvider;
  providerAccountId: string | null;
  providerAccountName: string | null;
  refreshTokenExpiresAt: Date | null;
  scopes: string[];
  toolManifest: FullConnectorToolManifest;
}

export async function finalizeCurrentUserConnectorConnection(
  db: Database,
  input: FinalizeCurrentUserConnectorConnectionInput
): Promise<UserConnectorConnection> {
  const inserted = await db.transaction(async (tx) => {
    const current = await getCurrentUserConnectorConnection(tx, input);
    const now = new Date();

    if (!matchesObservedCurrentConnection(input, current)) {
      throw currentConnectorConnectionChangedError(input);
    }

    if (current) {
      const result = await tx
        .update(userConnectorConnections)
        .set(revokedUserConnectorConnectionValues(now))
        .where(observedCurrentConnectorMutationWhere(input, current));

      if (getRowsAffected(result) === 0) {
        throw new Error(
          `Failed to revoke current user connector connection ${current.id}`
        );
      }
    }

    const [row] = await tx
      .insert(userConnectorConnections)
      .values({
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        clerkUserId: input.clerkUserId,
        currentUserProviderKey: currentUserProviderKey(
          input.clerkUserId,
          input.provider
        ),
        encryptedAccessToken: input.encryptedAccessToken,
        encryptedRefreshToken: input.encryptedRefreshToken,
        lastToolRefreshAt: input.lastToolRefreshAt ?? null,
        lastToolRefreshErrorAt: input.lastToolRefreshErrorAt ?? null,
        lastToolRefreshErrorCode: input.lastToolRefreshErrorCode ?? null,
        mcpEndpoint: input.mcpEndpoint,
        metadata: input.metadata,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        providerAccountName: input.providerAccountName,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        revokedAt: null,
        scopes: input.scopes,
        status: "active",
        toolManifest: input.toolManifest,
      })
      .$returningId();

    if (!row?.id) {
      throw new Error(
        `Failed to insert user connector connection for user ${input.clerkUserId}`
      );
    }

    const insertedConnection = await getUserConnectorConnectionById(tx, row.id);
    if (!insertedConnection) {
      throw new Error(
        `Failed to insert user connector connection for user ${input.clerkUserId}`
      );
    }
    return insertedConnection;
  });

  if (!inserted) {
    throw new Error(
      `Failed to insert user connector connection for user ${input.clerkUserId}`
    );
  }
  return inserted;
}

export async function markCurrentUserConnectorConnectionRevoked(
  db: Database,
  input: ObservedCurrentUserConnectorConnectionInput
): Promise<UserConnectorConnection | undefined> {
  const current = await getCurrentUserConnectorConnection(db, input);
  if (!current) {
    return;
  }

  if (!matchesObservedCurrentConnection(input, current)) {
    return;
  }

  const result = await db
    .update(userConnectorConnections)
    .set(revokedUserConnectorConnectionValues(new Date()))
    .where(observedCurrentConnectorMutationWhere(input, current));

  if (getRowsAffected(result) === 0) {
    return;
  }

  return await getUserConnectorConnectionById(db, current.id);
}

export async function markCurrentUserConnectorConnectionError(
  db: Database,
  input: GetCurrentUserConnectorConnectionInput
): Promise<UserConnectorConnection | undefined> {
  const current = await getCurrentUserConnectorConnection(db, input);
  if (!current) {
    return;
  }

  const result = await db
    .update(userConnectorConnections)
    .set({
      status: "error",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userConnectorConnections.id, current.id),
        currentConnectorWhere(input),
        eq(userConnectorConnections.status, current.status)
      )
    );

  if (getRowsAffected(result) === 0) {
    return;
  }

  return await getUserConnectorConnectionById(db, current.id);
}

export interface UpdateUserConnectorToolManifestInput
  extends GetCurrentUserConnectorConnectionInput {
  lastToolRefreshAt: Date;
  toolManifest: FullConnectorToolManifest;
}

export async function updateUserConnectorToolManifest(
  db: Database,
  input: UpdateUserConnectorToolManifestInput
): Promise<boolean> {
  const result = await db
    .update(userConnectorConnections)
    .set({
      lastToolRefreshAt: input.lastToolRefreshAt,
      lastToolRefreshErrorAt: null,
      lastToolRefreshErrorCode: null,
      toolManifest: input.toolManifest,
      updatedAt: input.lastToolRefreshAt,
    })
    .where(activeCurrentConnectorWhere(input));

  return getRowsAffected(result) > 0;
}

export interface RecordUserConnectorToolRefreshErrorInput
  extends GetCurrentUserConnectorConnectionInput {
  lastToolRefreshErrorAt: Date;
  lastToolRefreshErrorCode: string;
}

export async function recordUserConnectorToolRefreshError(
  db: Database,
  input: RecordUserConnectorToolRefreshErrorInput
): Promise<boolean> {
  const result = await db
    .update(userConnectorConnections)
    .set({
      lastToolRefreshErrorAt: input.lastToolRefreshErrorAt,
      lastToolRefreshErrorCode: input.lastToolRefreshErrorCode,
      updatedAt: input.lastToolRefreshErrorAt,
    })
    .where(activeCurrentConnectorWhere(input));

  return getRowsAffected(result) > 0;
}

async function getUserConnectorConnectionById(
  db: Database,
  id: number
): Promise<UserConnectorConnection | undefined> {
  const [row] = await db
    .select(connectionSelection)
    .from(userConnectorConnections)
    .where(eq(userConnectorConnections.id, id))
    .limit(1);
  return row;
}

function currentConnectorWhere(input: GetCurrentUserConnectorConnectionInput) {
  return eq(
    userConnectorConnections.currentUserProviderKey,
    currentUserProviderKey(input.clerkUserId, input.provider)
  );
}

function activeCurrentConnectorWhere(
  input: GetCurrentUserConnectorConnectionInput
) {
  return and(
    currentConnectorWhere(input),
    eq(userConnectorConnections.status, "active")
  );
}

function matchesObservedCurrentConnection(
  input: ObservedCurrentUserConnectorConnectionInput,
  current: UserConnectorConnection | undefined
) {
  if (
    input.observedCurrentConnectionId !== undefined &&
    (current?.id ?? null) !== input.observedCurrentConnectionId
  ) {
    return false;
  }

  if (
    input.observedEncryptedAccessToken !== undefined &&
    (current?.encryptedAccessToken ?? null) !==
      input.observedEncryptedAccessToken
  ) {
    return false;
  }

  if (
    input.observedEncryptedRefreshToken !== undefined &&
    (current?.encryptedRefreshToken ?? null) !==
      input.observedEncryptedRefreshToken
  ) {
    return false;
  }

  return true;
}

function observedCurrentConnectorMutationWhere(
  input: ObservedCurrentUserConnectorConnectionInput,
  current: UserConnectorConnection
) {
  const conditions = [
    eq(userConnectorConnections.id, current.id),
    eq(userConnectorConnections.status, current.status),
  ];

  if (input.observedEncryptedAccessToken !== undefined) {
    conditions.push(
      input.observedEncryptedAccessToken === null
        ? isNull(userConnectorConnections.encryptedAccessToken)
        : eq(
            userConnectorConnections.encryptedAccessToken,
            input.observedEncryptedAccessToken
          )
    );
  }

  if (input.observedEncryptedRefreshToken !== undefined) {
    conditions.push(
      input.observedEncryptedRefreshToken === null
        ? isNull(userConnectorConnections.encryptedRefreshToken)
        : eq(
            userConnectorConnections.encryptedRefreshToken,
            input.observedEncryptedRefreshToken
          )
    );
  }

  return and(...conditions);
}

function currentConnectorConnectionChangedError(
  input: GetCurrentUserConnectorConnectionInput
) {
  return new Error(
    `Current user connector connection changed for user ${input.clerkUserId} provider ${input.provider}`
  );
}

function revokedUserConnectorConnectionValues(now: Date) {
  return {
    accessTokenExpiresAt: null,
    currentUserProviderKey: null,
    encryptedAccessToken: null,
    encryptedRefreshToken: null,
    refreshTokenExpiresAt: null,
    revokedAt: now,
    status: "revoked" as const,
    toolManifest: [],
    updatedAt: now,
  };
}
