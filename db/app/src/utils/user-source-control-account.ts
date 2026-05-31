import { and, eq, getTableColumns } from "drizzle-orm";
import type { Database } from "../client";
import type {
  UserSourceControlAccount,
  UserSourceControlAccountProvider,
} from "../schema";
import { userSourceControlAccounts } from "../schema";
import { getRowsAffected, isDuplicateKeyError } from "./drizzle-results";

const {
  activeClerkUserId: _activeClerkUserId,
  activeProviderUserKey: _activeProviderUserKey,
  ...accountSelection
} = getTableColumns(userSourceControlAccounts);

export function activeProviderUserKey(
  provider: UserSourceControlAccountProvider,
  providerUserId: string
) {
  return `${provider}:${providerUserId}`;
}

export async function getActiveUserSourceControlAccount(
  db: Database,
  clerkUserId: string
): Promise<UserSourceControlAccount | undefined> {
  const [row] = await db
    .select(accountSelection)
    .from(userSourceControlAccounts)
    .where(
      and(
        eq(userSourceControlAccounts.clerkUserId, clerkUserId),
        eq(userSourceControlAccounts.status, "active")
      )
    )
    .limit(1);
  return row;
}

export async function isUserSourceControlBound(
  db: Database,
  clerkUserId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: userSourceControlAccounts.id })
    .from(userSourceControlAccounts)
    .where(
      and(
        eq(userSourceControlAccounts.clerkUserId, clerkUserId),
        eq(userSourceControlAccounts.status, "active")
      )
    )
    .limit(1);
  return row !== undefined;
}

export interface GetUserSourceControlAccountByProviderUserInput {
  provider: UserSourceControlAccountProvider;
  providerUserId: string;
}

export async function getUserSourceControlAccountByProviderUser(
  db: Database,
  input: GetUserSourceControlAccountByProviderUserInput
): Promise<UserSourceControlAccount | undefined> {
  return await getActiveAccountByProviderUser(db, input);
}

export type UserSourceControlAccountConflictCode =
  | "LIGHTFAST_USER_ALREADY_BOUND"
  | "PROVIDER_USER_ALREADY_BOUND";

type InactiveUserSourceControlAccountStatus = "expired" | "revoked";

export class UserSourceControlAccountConflictError extends Error {
  constructor(
    public readonly code: UserSourceControlAccountConflictCode,
    message: string
  ) {
    super(message);
    this.name = "UserSourceControlAccountConflictError";
  }
}

export interface FinalizeActiveUserSourceControlAccountInput {
  accessTokenExpiresAt: Date;
  clerkUserId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  provider: UserSourceControlAccountProvider;
  providerUserId: string;
  refreshTokenExpiresAt: Date;
}

export async function finalizeActiveUserSourceControlAccount(
  db: Database,
  input: FinalizeActiveUserSourceControlAccountInput
): Promise<UserSourceControlAccount> {
  const activeAccount = await getActiveUserSourceControlAccount(
    db,
    input.clerkUserId
  );
  if (activeAccount) {
    if (isExactProviderUserAccount(activeAccount, input)) {
      return await updateUserSourceControlAccountTokens(
        db,
        activeAccount.id,
        input
      );
    }

    throw new UserSourceControlAccountConflictError(
      "LIGHTFAST_USER_ALREADY_BOUND",
      `User ${input.clerkUserId} is already bound to another provider user`
    );
  }

  const activeProviderAccount = await getActiveAccountByProviderUser(db, input);
  if (activeProviderAccount) {
    throw new UserSourceControlAccountConflictError(
      "PROVIDER_USER_ALREADY_BOUND",
      `Provider user ${input.providerUserId} is already bound to another Lightfast user`
    );
  }

  const historicalAccount = await getUserAccountByClerkAndProviderUser(
    db,
    input
  );
  if (historicalAccount) {
    let duplicateError: unknown;
    const result = await db
      .update(userSourceControlAccounts)
      .set({
        activeClerkUserId: input.clerkUserId,
        activeProviderUserKey: activeProviderUserKey(
          input.provider,
          input.providerUserId
        ),
        encryptedAccessToken: input.encryptedAccessToken,
        encryptedRefreshToken: input.encryptedRefreshToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        revokedAt: null,
        status: "active",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userSourceControlAccounts.id, historicalAccount.id),
          eq(userSourceControlAccounts.clerkUserId, input.clerkUserId),
          eq(userSourceControlAccounts.provider, input.provider),
          eq(userSourceControlAccounts.providerUserId, input.providerUserId),
          eq(userSourceControlAccounts.status, historicalAccount.status)
        )
      )
      .catch((error: unknown) => {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
        duplicateError = error;
        return;
      });

    if (duplicateError) {
      return await recoverUserSourceControlAccountRace(
        db,
        input,
        duplicateError
      );
    }

    if (getRowsAffected(result) === 0) {
      return await recoverUserSourceControlAccountRace(
        db,
        input,
        new Error(
          `Failed to reactivate source-control account for user ${input.clerkUserId}`
        )
      );
    }

    const reactivated = await getActiveUserSourceControlAccount(
      db,
      input.clerkUserId
    );
    if (!reactivated) {
      throw new Error(
        `Failed to reactivate source-control account for user ${input.clerkUserId}`
      );
    }
    return reactivated;
  }

  return await insertActiveUserSourceControlAccount(db, input);
}

export interface MarkUserSourceControlAccountRevokedInput {
  clerkUserId: string;
}

export async function markUserSourceControlAccountRevoked(
  db: Database,
  input: MarkUserSourceControlAccountRevokedInput
): Promise<UserSourceControlAccount | undefined> {
  const now = new Date();
  return await markActiveUserSourceControlAccountInactive(db, input, {
    revokedAt: now,
    status: "revoked",
    updatedAt: now,
  });
}

export interface MarkUserSourceControlAccountExpiredInput {
  clerkUserId: string;
}

export async function markUserSourceControlAccountExpired(
  db: Database,
  input: MarkUserSourceControlAccountExpiredInput
): Promise<UserSourceControlAccount | undefined> {
  return await markActiveUserSourceControlAccountInactive(db, input, {
    revokedAt: null,
    status: "expired",
    updatedAt: new Date(),
  });
}

export interface ObservedUserSourceControlAccountInput {
  clerkUserId: string;
  encryptedRefreshToken: string;
  id: number;
  now: Date;
}

export async function markObservedUserSourceControlAccountExpired(
  db: Database,
  input: ObservedUserSourceControlAccountInput
): Promise<boolean> {
  return await markObservedUserSourceControlAccountInactive(db, input, {
    revokedAt: null,
    status: "expired",
  });
}

export async function markObservedUserSourceControlAccountRevoked(
  db: Database,
  input: ObservedUserSourceControlAccountInput
): Promise<boolean> {
  return await markObservedUserSourceControlAccountInactive(db, input, {
    revokedAt: input.now,
    status: "revoked",
  });
}

export interface UpdateObservedUserSourceControlAccountTokensInput {
  accessTokenExpiresAt: Date;
  clerkUserId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  id: number;
  observedEncryptedRefreshToken: string;
  refreshTokenExpiresAt: Date;
  updatedAt: Date;
}

export async function updateObservedUserSourceControlAccountTokens(
  db: Database,
  input: UpdateObservedUserSourceControlAccountTokensInput
): Promise<boolean> {
  const result = await db
    .update(userSourceControlAccounts)
    .set({
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken,
      refreshTokenExpiresAt: input.refreshTokenExpiresAt,
      updatedAt: input.updatedAt,
    })
    .where(
      and(
        eq(userSourceControlAccounts.id, input.id),
        eq(userSourceControlAccounts.clerkUserId, input.clerkUserId),
        eq(
          userSourceControlAccounts.encryptedRefreshToken,
          input.observedEncryptedRefreshToken
        ),
        eq(userSourceControlAccounts.status, "active")
      )
    );

  return getRowsAffected(result) > 0;
}

async function getUserSourceControlAccountById(
  db: Database,
  id: number
): Promise<UserSourceControlAccount | undefined> {
  const [row] = await db
    .select(accountSelection)
    .from(userSourceControlAccounts)
    .where(eq(userSourceControlAccounts.id, id))
    .limit(1);
  return row;
}

async function getActiveAccountByProviderUser(
  db: Database,
  input: GetUserSourceControlAccountByProviderUserInput
): Promise<UserSourceControlAccount | undefined> {
  const [row] = await db
    .select(accountSelection)
    .from(userSourceControlAccounts)
    .where(
      and(
        eq(
          userSourceControlAccounts.activeProviderUserKey,
          activeProviderUserKey(input.provider, input.providerUserId)
        ),
        eq(userSourceControlAccounts.status, "active")
      )
    )
    .limit(1);
  return row;
}

async function getUserAccountByClerkAndProviderUser(
  db: Database,
  input: FinalizeActiveUserSourceControlAccountInput
): Promise<UserSourceControlAccount | undefined> {
  const [row] = await db
    .select(accountSelection)
    .from(userSourceControlAccounts)
    .where(
      and(
        eq(userSourceControlAccounts.clerkUserId, input.clerkUserId),
        eq(userSourceControlAccounts.provider, input.provider),
        eq(userSourceControlAccounts.providerUserId, input.providerUserId)
      )
    )
    .limit(1);
  return row;
}

async function updateUserSourceControlAccountTokens(
  db: Database,
  accountId: number,
  input: FinalizeActiveUserSourceControlAccountInput
): Promise<UserSourceControlAccount> {
  const result = await db
    .update(userSourceControlAccounts)
    .set({
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken,
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      refreshTokenExpiresAt: input.refreshTokenExpiresAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userSourceControlAccounts.id, accountId),
        eq(userSourceControlAccounts.clerkUserId, input.clerkUserId),
        eq(userSourceControlAccounts.provider, input.provider),
        eq(userSourceControlAccounts.providerUserId, input.providerUserId),
        eq(userSourceControlAccounts.status, "active")
      )
    );

  if (getRowsAffected(result) === 0) {
    throw new Error(
      `Failed to update active source-control account ${accountId}`
    );
  }

  const updated = await getUserSourceControlAccountById(db, accountId);
  if (!updated) {
    throw new Error(
      `Failed to update active source-control account ${accountId}`
    );
  }
  return updated;
}

async function insertActiveUserSourceControlAccount(
  db: Database,
  input: FinalizeActiveUserSourceControlAccountInput
): Promise<UserSourceControlAccount> {
  let duplicateError: unknown;
  const [row] = await db
    .insert(userSourceControlAccounts)
    .values({
      activeClerkUserId: input.clerkUserId,
      activeProviderUserKey: activeProviderUserKey(
        input.provider,
        input.providerUserId
      ),
      clerkUserId: input.clerkUserId,
      provider: input.provider,
      providerUserId: input.providerUserId,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken,
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      refreshTokenExpiresAt: input.refreshTokenExpiresAt,
      revokedAt: null,
      status: "active",
    })
    .$returningId()
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      duplicateError = error;
      return [];
    });

  if (duplicateError) {
    return await recoverUserSourceControlAccountRace(db, input, duplicateError);
  }

  if (!row?.id) {
    throw new Error(
      `Failed to insert active source-control account for user ${input.clerkUserId}`
    );
  }

  const inserted = await getUserSourceControlAccountById(db, row.id);
  if (!inserted) {
    throw new Error(
      `Failed to insert active source-control account for user ${input.clerkUserId}`
    );
  }
  return inserted;
}

async function recoverUserSourceControlAccountRace(
  db: Database,
  input: FinalizeActiveUserSourceControlAccountInput,
  fallbackError: unknown
): Promise<UserSourceControlAccount> {
  const activeAccount = await getActiveUserSourceControlAccount(
    db,
    input.clerkUserId
  );
  const activeProviderAccount = await getActiveAccountByProviderUser(db, input);

  if (activeAccount) {
    if (isExactProviderUserAccount(activeAccount, input)) {
      return await updateUserSourceControlAccountTokens(
        db,
        activeAccount.id,
        input
      );
    }

    throw new UserSourceControlAccountConflictError(
      "LIGHTFAST_USER_ALREADY_BOUND",
      `User ${input.clerkUserId} is already bound to another provider user`
    );
  }

  if (activeProviderAccount) {
    if (activeProviderAccount.clerkUserId !== input.clerkUserId) {
      throw new UserSourceControlAccountConflictError(
        "PROVIDER_USER_ALREADY_BOUND",
        `Provider user ${input.providerUserId} is already bound to another Lightfast user`
      );
    }

    if (isExactProviderUserAccount(activeProviderAccount, input)) {
      return await updateUserSourceControlAccountTokens(
        db,
        activeProviderAccount.id,
        input
      );
    }
  }

  throw fallbackError;
}

async function markActiveUserSourceControlAccountInactive(
  db: Database,
  input: { clerkUserId: string },
  state: {
    revokedAt: Date | null;
    status: InactiveUserSourceControlAccountStatus;
    updatedAt: Date;
  }
): Promise<UserSourceControlAccount | undefined> {
  const activeAccount = await getActiveUserSourceControlAccount(
    db,
    input.clerkUserId
  );
  if (!activeAccount) {
    return;
  }

  const result = await db
    .update(userSourceControlAccounts)
    .set(inactiveUserSourceControlAccountValues(state))
    .where(
      and(
        eq(userSourceControlAccounts.id, activeAccount.id),
        eq(userSourceControlAccounts.status, "active")
      )
    );

  if (getRowsAffected(result) === 0) {
    return;
  }

  return await getUserSourceControlAccountById(db, activeAccount.id);
}

async function markObservedUserSourceControlAccountInactive(
  db: Database,
  input: ObservedUserSourceControlAccountInput,
  state: {
    revokedAt: Date | null;
    status: InactiveUserSourceControlAccountStatus;
  }
): Promise<boolean> {
  const result = await db
    .update(userSourceControlAccounts)
    .set(
      inactiveUserSourceControlAccountValues({ ...state, updatedAt: input.now })
    )
    .where(
      and(
        eq(userSourceControlAccounts.id, input.id),
        eq(userSourceControlAccounts.clerkUserId, input.clerkUserId),
        eq(
          userSourceControlAccounts.encryptedRefreshToken,
          input.encryptedRefreshToken
        ),
        eq(userSourceControlAccounts.status, "active")
      )
    );

  return getRowsAffected(result) > 0;
}

function inactiveUserSourceControlAccountValues(state: {
  revokedAt: Date | null;
  status: InactiveUserSourceControlAccountStatus;
  updatedAt: Date;
}) {
  return {
    activeClerkUserId: null,
    activeProviderUserKey: null,
    revokedAt: state.revokedAt,
    status: state.status,
    updatedAt: state.updatedAt,
  };
}

function isExactProviderUserAccount(
  account: UserSourceControlAccount,
  input: FinalizeActiveUserSourceControlAccountInput
): boolean {
  return (
    account.clerkUserId === input.clerkUserId &&
    account.provider === input.provider &&
    account.providerUserId === input.providerUserId
  );
}
