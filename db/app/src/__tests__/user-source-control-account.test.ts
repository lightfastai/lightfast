import { getTableConfig } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../client";
import type { UserSourceControlAccount } from "../schema";
import { userSourceControlAccounts } from "../schema";
import {
  activeProviderUserKey,
  finalizeActiveUserSourceControlAccount,
  getUserSourceControlAccountByProviderUser,
  markUserSourceControlAccountExpired,
  markUserSourceControlAccountRevoked,
} from "../utils/user-source-control-account";

describe("userSourceControlAccounts schema", () => {
  it("uses active-row uniqueness mirrors for Clerk and provider user ids", () => {
    const config = getTableConfig(userSourceControlAccounts);
    const columnsByName = new Map(
      config.columns.map((column) => [column.name, column])
    );
    const indexesByName = new Map(
      config.indexes.map((index) => [index.config.name, index])
    );
    const columnNames = config.columns.map((column) => column.name);
    const indexColumnNames = (indexName: string) =>
      indexesByName.get(indexName)?.config.columns.map((column) => {
        expect("name" in column).toBe(true);
        return "name" in column ? column.name : undefined;
      });

    expect(config.name).toBe("lightfast_user_source_control_accounts");
    expect(columnNames).toEqual(
      expect.arrayContaining([
        "clerk_user_id",
        "active_clerk_user_id",
        "active_provider_user_key",
        "provider",
        "provider_user_id",
        "encrypted_access_token",
        "encrypted_refresh_token",
        "access_token_expires_at",
        "refresh_token_expires_at",
      ])
    );
    expect(columnNames).not.toContain("provider_login");
    expect(columnNames).not.toContain("provider_avatar_url");
    expect(columnNames).not.toContain("provider_profile_url");
    expect(columnNames).not.toContain("provider_email");
    expect(columnNames).not.toContain("metadata");
    expect(columnNames).not.toContain("scope");

    expect(columnsByName.get("active_clerk_user_id")?.notNull).toBe(false);
    expect(columnsByName.get("active_provider_user_key")?.notNull).toBe(false);

    expect(
      indexesByName.get("user_source_control_accounts_active_user_uq")?.config
    ).toMatchObject({
      unique: true,
    });
    expect(
      indexColumnNames("user_source_control_accounts_active_user_uq")
    ).toEqual(["active_clerk_user_id"]);

    expect(
      indexesByName.get("user_source_control_accounts_active_provider_user_uq")
        ?.config
    ).toMatchObject({
      unique: true,
    });
    expect(
      indexColumnNames("user_source_control_accounts_active_provider_user_uq")
    ).toEqual(["active_provider_user_key"]);

    expect(
      indexesByName.get("user_source_control_accounts_user_status_idx")?.config
    ).toMatchObject({
      unique: false,
    });
    expect(
      indexColumnNames("user_source_control_accounts_user_status_idx")
    ).toEqual(["clerk_user_id", "status"]);

    expect(
      indexesByName.get("user_source_control_accounts_provider_user_idx")
        ?.config
    ).toMatchObject({
      unique: false,
    });
    expect(
      indexColumnNames("user_source_control_accounts_provider_user_idx")
    ).toEqual(["provider", "provider_user_id"]);
  });
});

function account(
  overrides: Partial<UserSourceControlAccount> = {}
): UserSourceControlAccount {
  return {
    id: 1,
    clerkUserId: "user_1",
    provider: "github",
    providerUserId: "12345",
    status: "active",
    connectedAt: new Date("2026-05-30T00:00:00.000Z"),
    revokedAt: null,
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    accessTokenExpiresAt: new Date("2026-05-30T08:00:00.000Z"),
    refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
    createdAt: new Date("2026-05-30T00:00:00.000Z"),
    updatedAt: new Date("2026-05-30T00:00:00.000Z"),
    ...overrides,
  };
}

function finalizeInput(
  overrides: Partial<
    Parameters<typeof finalizeActiveUserSourceControlAccount>[1]
  > = {}
): Parameters<typeof finalizeActiveUserSourceControlAccount>[1] {
  return {
    accessTokenExpiresAt: new Date("2026-05-30T09:00:00.000Z"),
    clerkUserId: "user_1",
    encryptedAccessToken: "encrypted_access_next",
    encryptedRefreshToken: "encrypted_refresh_next",
    provider: "github",
    providerUserId: "12345",
    refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    ...overrides,
  };
}

function selectRows<T>(rows: T[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  };
}

function duplicateKeyError() {
  return Object.assign(new Error("Duplicate entry for key"), {
    code: "ER_DUP_ENTRY",
  });
}

function collectColumnNames(value: unknown, seen = new WeakSet<object>()) {
  if (value === null || typeof value !== "object") {
    return [];
  }
  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  const names: string[] = [];
  if ("name" in value && typeof value.name === "string") {
    names.push(value.name);
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === "table") {
      continue;
    }
    names.push(...collectColumnNames(nested, seen));
  }
  return names;
}

it("builds active provider user keys from stable provider ids", () => {
  expect(activeProviderUserKey("github", "12345")).toBe("github:12345");
});

it("looks up provider users through active mirrors only", async () => {
  const active = account({ clerkUserId: "user_2" });
  const where = vi.fn((_condition: unknown) => ({
    limit: () => Promise.resolve([active]),
  }));
  const select = vi.fn(() => ({ from: () => ({ where }) }));
  const db = { select } as unknown as Database;

  await expect(
    getUserSourceControlAccountByProviderUser(db, {
      provider: "github",
      providerUserId: "12345",
    })
  ).resolves.toBe(active);

  const columnNames = collectColumnNames(where.mock.calls[0]?.[0]);
  expect(columnNames).toContain("active_provider_user_key");
  expect(columnNames).toContain("status");
  expect(columnNames).not.toContain("provider_user_id");
});

it("finalizes new active user account rows with active uniqueness mirrors", async () => {
  const inserted = account();
  const returningId = vi.fn(() => Promise.resolve([{ id: 1 }]));
  const values = vi.fn(() => ({ $returningId: returningId }));
  const insert = vi.fn(() => ({ values }));
  const activeLimit = vi.fn(() => Promise.resolve([]));
  const providerLimit = vi.fn(() => Promise.resolve([]));
  const historicalLimit = vi.fn(() => Promise.resolve([]));
  const insertedLimit = vi.fn(() => Promise.resolve([inserted]));
  const select = vi
    .fn()
    .mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: activeLimit }) }),
    })
    .mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: providerLimit }) }),
    })
    .mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: historicalLimit }) }),
    })
    .mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: insertedLimit }) }),
    });
  const db = { insert, select } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, {
      accessTokenExpiresAt: inserted.accessTokenExpiresAt,
      clerkUserId: "user_1",
      encryptedAccessToken: "encrypted_access",
      encryptedRefreshToken: "encrypted_refresh",
      provider: "github",
      providerUserId: "12345",
      refreshTokenExpiresAt: inserted.refreshTokenExpiresAt,
    })
  ).resolves.toMatchObject({ clerkUserId: "user_1", providerUserId: "12345" });

  expect(values).toHaveBeenCalledWith(
    expect.objectContaining({
      activeClerkUserId: "user_1",
      activeProviderUserKey: "github:12345",
      status: "active",
    })
  );
});

it("revokes active user account rows by clearing active mirrors", async () => {
  const active = account();
  const selectLimit = vi.fn(() => Promise.resolve([active]));
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi
    .fn()
    .mockReturnValueOnce({ from: selectFrom })
    .mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              { ...active, status: "revoked", revokedAt: expect.any(Date) },
            ]),
        }),
      }),
    });
  const updateWhere = vi.fn((_condition: unknown) =>
    Promise.resolve({ affectedRows: 1 })
  );
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const db = { select, update } as unknown as Database;

  await markUserSourceControlAccountRevoked(db, { clerkUserId: "user_1" });

  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({
      activeClerkUserId: null,
      activeProviderUserKey: null,
      status: "revoked",
      revokedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
  );
  const columnNames = collectColumnNames(updateWhere.mock.calls[0]?.[0]);
  expect(columnNames).toContain("id");
  expect(columnNames).toContain("status");
});

it("returns undefined when revoking a stale active row", async () => {
  const active = account();
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([active]))
    .mockReturnValueOnce(selectRows([account({ status: "revoked" })]));
  const set = vi.fn(() => ({
    where: () => Promise.resolve({ affectedRows: 0 }),
  }));
  const update = vi.fn(() => ({ set }));
  const db = { select, update } as unknown as Database;

  await expect(
    markUserSourceControlAccountRevoked(db, { clerkUserId: "user_1" })
  ).resolves.toBeUndefined();
});

it("updates tokens when finalizing an already active exact user account", async () => {
  const active = account();
  const updated = account({
    encryptedAccessToken: "encrypted_access_next",
    encryptedRefreshToken: "encrypted_refresh_next",
    accessTokenExpiresAt: new Date("2026-05-30T09:00:00.000Z"),
    refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
  });
  const updateWhere = vi.fn((_condition: unknown) =>
    Promise.resolve({ affectedRows: 1 })
  );
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([active]))
    .mockReturnValueOnce(selectRows([updated]));
  const db = { select, update } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).resolves.toMatchObject({ encryptedAccessToken: "encrypted_access_next" });

  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({
      encryptedAccessToken: "encrypted_access_next",
      encryptedRefreshToken: "encrypted_refresh_next",
      accessTokenExpiresAt: new Date("2026-05-30T09:00:00.000Z"),
      refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
      updatedAt: expect.any(Date),
    })
  );
  const columnNames = collectColumnNames(updateWhere.mock.calls[0]?.[0]);
  expect(columnNames).toContain("id");
  expect(columnNames).toContain("clerk_user_id");
  expect(columnNames).toContain("provider");
  expect(columnNames).toContain("provider_user_id");
  expect(columnNames).toContain("status");
});

it("rejects stale active token updates", async () => {
  const active = account();
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([active]))
    .mockReturnValueOnce(
      selectRows([account({ encryptedAccessToken: "stale_access" })])
    );
  const set = vi.fn(() => ({
    where: () => Promise.resolve({ affectedRows: 0 }),
  }));
  const update = vi.fn(() => ({ set }));
  const db = { select, update } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).rejects.toThrow("Failed to update active source-control account 1");
});

it("rejects finalizing a different provider user for an already bound Clerk user", async () => {
  const select = vi.fn().mockReturnValueOnce(
    selectRows([
      account({
        providerUserId: "99999",
      }),
    ])
  );
  const db = { select } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).rejects.toMatchObject({
    code: "LIGHTFAST_USER_ALREADY_BOUND",
  });
});

it("rejects finalizing a provider user already bound to another Clerk user", async () => {
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([account({ clerkUserId: "user_2" })]));
  const db = { select } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).rejects.toMatchObject({
    code: "PROVIDER_USER_ALREADY_BOUND",
  });
});

it("reactivates historical inactive rows for the same Clerk and provider user", async () => {
  const historical = account({
    id: 5,
    status: "revoked",
    revokedAt: new Date("2026-05-29T00:00:00.000Z"),
  });
  const reactivated = account({
    id: 5,
    encryptedAccessToken: "encrypted_access_next",
    encryptedRefreshToken: "encrypted_refresh_next",
  });
  const set = vi.fn(() => ({
    where: () => Promise.resolve({ affectedRows: 1 }),
  }));
  const update = vi.fn(() => ({ set }));
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([historical]))
    .mockReturnValueOnce(selectRows([reactivated]));
  const db = { select, update } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).resolves.toMatchObject({ id: 5, status: "active" });

  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({
      activeClerkUserId: "user_1",
      activeProviderUserKey: "github:12345",
      encryptedAccessToken: "encrypted_access_next",
      encryptedRefreshToken: "encrypted_refresh_next",
      revokedAt: null,
      status: "active",
      updatedAt: expect.any(Date),
    })
  );
});

it("recovers duplicate historical reactivations for exact active accounts", async () => {
  const historical = account({ id: 5, status: "revoked" });
  const active = account();
  const updated = account({
    encryptedAccessToken: "encrypted_access_next",
    encryptedRefreshToken: "encrypted_refresh_next",
  });
  const reactivateSet = vi.fn(() => ({
    where: () => Promise.reject(duplicateKeyError()),
  }));
  const tokenSet = vi.fn(() => ({
    where: () => Promise.resolve({ affectedRows: 1 }),
  }));
  const update = vi
    .fn()
    .mockReturnValueOnce({ set: reactivateSet })
    .mockReturnValueOnce({ set: tokenSet });
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([historical]))
    .mockReturnValueOnce(selectRows([active]))
    .mockReturnValueOnce(selectRows([active]))
    .mockReturnValueOnce(selectRows([updated]));
  const db = { select, update } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).resolves.toMatchObject({ encryptedAccessToken: "encrypted_access_next" });

  expect(tokenSet).toHaveBeenCalledWith(
    expect.objectContaining({
      encryptedAccessToken: "encrypted_access_next",
      encryptedRefreshToken: "encrypted_refresh_next",
      updatedAt: expect.any(Date),
    })
  );
});

it("recovers duplicate historical reactivations as provider-user conflicts", async () => {
  const historical = account({ id: 5, status: "revoked" });
  const set = vi.fn(() => ({
    where: () => Promise.reject(duplicateKeyError()),
  }));
  const update = vi.fn(() => ({ set }));
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([historical]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([account({ clerkUserId: "user_2" })]));
  const db = { select, update } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).rejects.toMatchObject({
    code: "PROVIDER_USER_ALREADY_BOUND",
  });
});

it("recovers duplicate historical reactivations as Clerk-user conflicts", async () => {
  const historical = account({ id: 5, status: "revoked" });
  const set = vi.fn(() => ({
    where: () => Promise.reject(duplicateKeyError()),
  }));
  const update = vi.fn(() => ({ set }));
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([historical]))
    .mockReturnValueOnce(selectRows([account({ providerUserId: "99999" })]))
    .mockReturnValueOnce(selectRows([]));
  const db = { select, update } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).rejects.toMatchObject({
    code: "LIGHTFAST_USER_ALREADY_BOUND",
  });
});

it("recovers zero-row historical reactivations for exact active accounts", async () => {
  const historical = account({ id: 5, status: "revoked" });
  const active = account();
  const updated = account({
    encryptedAccessToken: "encrypted_access_next",
    encryptedRefreshToken: "encrypted_refresh_next",
  });
  const reactivateSet = vi.fn(() => ({
    where: () => Promise.resolve({ affectedRows: 0 }),
  }));
  const tokenSet = vi.fn(() => ({
    where: () => Promise.resolve({ affectedRows: 1 }),
  }));
  const update = vi
    .fn()
    .mockReturnValueOnce({ set: reactivateSet })
    .mockReturnValueOnce({ set: tokenSet });
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([historical]))
    .mockReturnValueOnce(selectRows([active]))
    .mockReturnValueOnce(selectRows([active]))
    .mockReturnValueOnce(selectRows([updated]));
  const db = { select, update } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).resolves.toMatchObject({ encryptedAccessToken: "encrypted_access_next" });

  expect(tokenSet).toHaveBeenCalledWith(
    expect.objectContaining({
      encryptedAccessToken: "encrypted_access_next",
      encryptedRefreshToken: "encrypted_refresh_next",
      updatedAt: expect.any(Date),
    })
  );
});

it("recovers zero-row historical reactivations as provider-user conflicts", async () => {
  const historical = account({ id: 5, status: "revoked" });
  const set = vi.fn(() => ({
    where: () => Promise.resolve({ affectedRows: 0 }),
  }));
  const update = vi.fn(() => ({ set }));
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([historical]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([account({ clerkUserId: "user_2" })]));
  const db = { select, update } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).rejects.toMatchObject({
    code: "PROVIDER_USER_ALREADY_BOUND",
  });
});

it("recovers zero-row historical reactivations as Clerk-user conflicts", async () => {
  const historical = account({ id: 5, status: "revoked" });
  const set = vi.fn(() => ({
    where: () => Promise.resolve({ affectedRows: 0 }),
  }));
  const update = vi.fn(() => ({ set }));
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([historical]))
    .mockReturnValueOnce(selectRows([account({ providerUserId: "99999" })]))
    .mockReturnValueOnce(selectRows([]));
  const db = { select, update } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).rejects.toMatchObject({
    code: "LIGHTFAST_USER_ALREADY_BOUND",
  });
});

it("expires active user account rows by clearing active mirrors", async () => {
  const active = account();
  const expired = account({ status: "expired", revokedAt: null });
  const updateWhere = vi.fn((_condition: unknown) =>
    Promise.resolve({ affectedRows: 1 })
  );
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([active]))
    .mockReturnValueOnce(selectRows([expired]));
  const db = { select, update } as unknown as Database;

  await markUserSourceControlAccountExpired(db, { clerkUserId: "user_1" });

  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({
      activeClerkUserId: null,
      activeProviderUserKey: null,
      status: "expired",
      revokedAt: null,
      updatedAt: expect.any(Date),
    })
  );
  const columnNames = collectColumnNames(updateWhere.mock.calls[0]?.[0]);
  expect(columnNames).toContain("id");
  expect(columnNames).toContain("status");
});

it("returns undefined when expiring a stale active row", async () => {
  const active = account();
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([active]))
    .mockReturnValueOnce(selectRows([account({ status: "expired" })]));
  const set = vi.fn(() => ({
    where: () => Promise.resolve({ affectedRows: 0 }),
  }));
  const update = vi.fn(() => ({ set }));
  const db = { select, update } as unknown as Database;

  await expect(
    markUserSourceControlAccountExpired(db, { clerkUserId: "user_1" })
  ).resolves.toBeUndefined();
});

it("recovers duplicate inserts as provider-user conflicts", async () => {
  const returningId = vi.fn(() => Promise.reject(duplicateKeyError()));
  const values = vi.fn(() => ({ $returningId: returningId }));
  const insert = vi.fn(() => ({ values }));
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([account({ clerkUserId: "user_2" })]));
  const db = { insert, select } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).rejects.toMatchObject({
    code: "PROVIDER_USER_ALREADY_BOUND",
  });
});

it("recovers duplicate inserts for exact active accounts by updating tokens", async () => {
  const active = account();
  const updated = account({
    encryptedAccessToken: "encrypted_access_next",
    encryptedRefreshToken: "encrypted_refresh_next",
  });
  const returningId = vi.fn(() => Promise.reject(duplicateKeyError()));
  const values = vi.fn(() => ({ $returningId: returningId }));
  const insert = vi.fn(() => ({ values }));
  const set = vi.fn(() => ({
    where: () => Promise.resolve({ affectedRows: 1 }),
  }));
  const update = vi.fn(() => ({ set }));
  const select = vi
    .fn()
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([]))
    .mockReturnValueOnce(selectRows([active]))
    .mockReturnValueOnce(selectRows([active]))
    .mockReturnValueOnce(selectRows([updated]));
  const db = { insert, select, update } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, finalizeInput())
  ).resolves.toMatchObject({ encryptedAccessToken: "encrypted_access_next" });

  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({
      encryptedAccessToken: "encrypted_access_next",
      encryptedRefreshToken: "encrypted_refresh_next",
      updatedAt: expect.any(Date),
    })
  );
});
