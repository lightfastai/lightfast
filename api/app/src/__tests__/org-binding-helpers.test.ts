import type { Database, OrgSourceControlBinding } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the shared client so the real binding helpers load env-free while the
// tests keep using fake DB objects.
vi.mock("@db/app/client", () => ({ db: {} }));

const {
  finalizeActiveOrgProviderBinding,
  getActiveOrgBinding,
  getOrgBindingByProviderInstallation,
  isOrgBound,
  upsertActiveOrgBinding,
  markOrgBindingRevoked,
  OrgSourceControlBindingConflictError,
} = await import("@db/app");

/**
 * A minimal stand-in for the Drizzle query slice the binding helpers use.
 *
 * The helpers issue `select().from().where().limit()`,
 * `insert().values().$returningId()`, and `update().set().where()`.
 * The fake records each terminal call and returns caller-supplied rows, so the
 * tests assert the helpers' *branch logic* — not Drizzle's SQL. The SQL-level
 * `status = 'active'` filter and the one-active-binding-per-org unique key
 * are schema concerns, verified by `pnpm --filter @db/app db:generate`.
 */
interface FakeDbConfig {
  insertError?: unknown;
  insertId?: number;
  /** One result array per `select()` chain, consumed in order. */
  selectResults?: Record<string, unknown>[][];
  updateResult?: OrgSourceControlBinding[];
}

function makeFakeDb(cfg: FakeDbConfig = {}) {
  const selectQueue = [...(cfg.selectResults ?? [])];
  const spies = {
    select: vi.fn(),
    insert: vi.fn(),
    insertValues: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    updateSet: vi.fn(),
  };
  const db = {
    select: (fields?: unknown) => {
      spies.select(fields);
      const result = selectQueue.shift() ?? [];
      const query = Promise.resolve(result) as Promise<unknown[]> & {
        limit: (n: number) => Promise<unknown[]>;
      };
      query.limit = (n: number) => {
        spies.limit(n);
        return Promise.resolve(result.slice(0, n));
      };
      return {
        from: () => ({
          where: () => query,
        }),
      };
    },
    insert: () => {
      spies.insert();
      return {
        values: (v: unknown) => {
          spies.insertValues(v);
          return {
            $returningId: () =>
              cfg.insertError
                ? Promise.reject(cfg.insertError)
                : Promise.resolve([{ id: cfg.insertId ?? 1 }]),
          };
        },
      };
    },
    update: () => {
      spies.update();
      return {
        set: (s: unknown) => {
          spies.updateSet(s);
          return {
            where: () => Promise.resolve(cfg.updateResult ?? []),
          };
        },
      };
    },
  };
  return { db: db as unknown as Database, spies };
}

function selectedKeys(
  spies: ReturnType<typeof makeFakeDb>["spies"],
  callIndex = 0
) {
  const fields = spies.select.mock.calls[callIndex]?.[0];
  expect(fields).toBeDefined();
  return Object.keys(fields as Record<string, unknown>);
}

function binding(
  overrides: Partial<OrgSourceControlBinding> = {}
): OrgSourceControlBinding {
  return {
    id: 1,
    clerkOrgId: "org_test",
    provider: "github",
    providerAccountId: null,
    providerAccountLogin: null,
    providerInstallationId: null,
    status: "active",
    connectedByUserId: "user_test",
    connectedAt: new Date(),
    revokedAt: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as OrgSourceControlBinding;
}

function duplicateBindingError(key: string) {
  return Object.assign(new Error(`Duplicate entry for key '${key}'`), {
    body: { code: "ER_DUP_ENTRY" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isOrgBound", () => {
  it("is false when the org has no active binding", async () => {
    const { db } = makeFakeDb({ selectResults: [[]] });
    expect(await isOrgBound(db, "org_none")).toBe(false);
  });

  it("is true when the org has an active binding", async () => {
    const { db } = makeFakeDb({ selectResults: [[{ id: 1 }]] });
    expect(await isOrgBound(db, "org_bound")).toBe(true);
  });

  it("selects only the binding id for the hot auth gate", async () => {
    const { db, spies } = makeFakeDb({ selectResults: [[{ id: 1 }]] });

    expect(await isOrgBound(db, "org_bound")).toBe(true);

    expect(selectedKeys(spies)).toEqual(["id"]);
  });

  it("is false for an org whose only binding is revoked", async () => {
    // The helper's query filters `status = 'active'`, so a revoked-only org
    // yields no rows — modelled here by an empty active-binding result.
    const { db } = makeFakeDb({ selectResults: [[]] });
    expect(await isOrgBound(db, "org_revoked")).toBe(false);
  });
});

describe("getActiveOrgBinding", () => {
  it("returns the active binding row when one exists", async () => {
    const row = binding({ clerkOrgId: "org_x" });
    const { db, spies } = makeFakeDb({ selectResults: [[row]] });

    expect(await getActiveOrgBinding(db, "org_x")).toEqual(row);
    expect(selectedKeys(spies)).not.toContain("activeClerkOrgId");
  });

  it("returns undefined when the org is not bound", async () => {
    const { db } = makeFakeDb({ selectResults: [[]] });
    expect(await getActiveOrgBinding(db, "org_x")).toBeUndefined();
  });
});

describe("getOrgBindingByProviderInstallation", () => {
  it("returns the binding for a provider installation", async () => {
    const row = binding({
      providerInstallationId: "1001",
      providerAccountLogin: "lightfast-emulated",
    });
    const { db } = makeFakeDb({ selectResults: [[row]] });

    await expect(
      getOrgBindingByProviderInstallation(db, {
        provider: "github",
        providerInstallationId: "1001",
      })
    ).resolves.toEqual(row);
  });
});

describe("upsertActiveOrgBinding", () => {
  it("is idempotent — returns the existing active binding without inserting", async () => {
    const existing = binding({ clerkOrgId: "org_dup" });
    const { db, spies } = makeFakeDb({ selectResults: [[existing]] });

    const result = await upsertActiveOrgBinding(db, {
      clerkOrgId: "org_dup",
      connectedByUserId: "user_2",
      provider: "github",
    });

    expect(result).toEqual(existing);
    expect(selectedKeys(spies)).not.toContain("activeClerkOrgId");
    // The application-level half of "one active binding per org": a second
    // bind never inserts a competing active row.
    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("inserts a new active binding when the org has none", async () => {
    const inserted = binding({ id: 99, clerkOrgId: "org_new" });
    const { db, spies } = makeFakeDb({
      insertId: 99,
      selectResults: [[], [inserted]],
    });

    const result = await upsertActiveOrgBinding(db, {
      clerkOrgId: "org_new",
      connectedByUserId: "user_3",
      provider: "github",
    });

    expect(result).toEqual(inserted);
    expect(selectedKeys(spies, 0)).not.toContain("activeClerkOrgId");
    expect(selectedKeys(spies, 1)).not.toContain("activeClerkOrgId");
    expect(spies.insert).toHaveBeenCalledTimes(1);
    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_new",
        connectedByUserId: "user_3",
        provider: "github",
        status: "active",
        activeClerkOrgId: "org_new",
        // No provider ids supplied → stored as null, never a fake value.
        providerAccountId: null,
        providerAccountLogin: null,
        providerInstallationId: null,
      })
    );
  });

  it("throws when the inserted row cannot be re-selected", async () => {
    const { db } = makeFakeDb({ insertId: 123, selectResults: [[], []] });

    await expect(
      upsertActiveOrgBinding(db, {
        clerkOrgId: "org_fail",
        connectedByUserId: "user_4",
        provider: "github",
      })
    ).rejects.toThrow(/Failed to insert active binding/);
  });

  it("returns the active binding when a concurrent bind wins the unique race", async () => {
    const existing = binding({ clerkOrgId: "org_race" });
    const duplicateError = Object.assign(
      new Error(
        "Duplicate entry 'org_race' for key 'org_source_control_bindings_active_per_org_uq'"
      ),
      { body: { code: "ER_DUP_ENTRY" } }
    );
    const { db, spies } = makeFakeDb({
      insertError: duplicateError,
      selectResults: [[], [existing]],
    });

    await expect(
      upsertActiveOrgBinding(db, {
        clerkOrgId: "org_race",
        connectedByUserId: "user_race",
        provider: "github",
      })
    ).resolves.toEqual(existing);
    expect(spies.insert).toHaveBeenCalledTimes(1);
  });
});

describe("finalizeActiveOrgProviderBinding", () => {
  it("inserts a verified provider binding when no binding exists", async () => {
    const inserted = binding({
      id: 100,
      clerkOrgId: "org_new",
      providerAccountId: "20",
      providerAccountLogin: "lightfast-emulated",
      providerInstallationId: "1001",
      metadata: {
        githubAppId: "424242",
        repositorySelection: "all",
      },
    });
    const { db, spies } = makeFakeDb({
      insertId: 100,
      selectResults: [[], [], [inserted]],
    });

    await expect(
      finalizeActiveOrgProviderBinding(db, {
        clerkOrgId: "org_new",
        connectedByUserId: "user_1",
        metadata: {
          githubAppId: "424242",
          repositorySelection: "all",
        },
        provider: "github",
        providerAccountId: "20",
        providerAccountLogin: "lightfast-emulated",
        providerInstallationId: "1001",
      })
    ).resolves.toEqual(inserted);

    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        activeClerkOrgId: "org_new",
        clerkOrgId: "org_new",
        provider: "github",
        providerAccountId: "20",
        providerAccountLogin: "lightfast-emulated",
        providerInstallationId: "1001",
        status: "active",
      })
    );
  });

  it("returns an existing exact active binding idempotently", async () => {
    const existing = binding({
      clerkOrgId: "org_existing",
      providerInstallationId: "1001",
    });
    const { db, spies } = makeFakeDb({ selectResults: [[existing]] });

    await expect(
      finalizeActiveOrgProviderBinding(db, {
        clerkOrgId: "org_existing",
        connectedByUserId: "user_1",
        provider: "github",
        providerInstallationId: "1001",
      })
    ).resolves.toEqual(existing);

    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("throws when the Lightfast org is already bound to another installation", async () => {
    const existing = binding({
      clerkOrgId: "org_existing",
      providerInstallationId: "2002",
    });
    const { db } = makeFakeDb({ selectResults: [[existing]] });

    const error = await finalizeActiveOrgProviderBinding(db, {
      clerkOrgId: "org_existing",
      connectedByUserId: "user_1",
      provider: "github",
      providerInstallationId: "1001",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OrgSourceControlBindingConflictError);
    expect(error).toEqual(
      expect.objectContaining({
        code: "ORG_ALREADY_BOUND",
      })
    );
  });

  it("throws when another Lightfast org already owns the installation", async () => {
    const existingInstallation = binding({
      clerkOrgId: "org_other",
      providerInstallationId: "1001",
    });
    const { db } = makeFakeDb({
      selectResults: [[], [existingInstallation]],
    });

    const error = await finalizeActiveOrgProviderBinding(db, {
      clerkOrgId: "org_new",
      connectedByUserId: "user_1",
      provider: "github",
      providerInstallationId: "1001",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OrgSourceControlBindingConflictError);
    expect(error).toEqual(
      expect.objectContaining({
        code: "INSTALLATION_ALREADY_BOUND",
      })
    );
  });

  it("reactivates a revoked binding for the same org and installation", async () => {
    const inactive = binding({
      clerkOrgId: "org_existing",
      providerInstallationId: "1001",
      providerAccountLogin: null,
      revokedAt: new Date("2026-05-26T06:45:00.123Z"),
      status: "revoked",
    });
    const reactivated = binding({
      clerkOrgId: "org_existing",
      providerInstallationId: "1001",
      providerAccountLogin: "lightfast-emulated",
    });
    const { db, spies } = makeFakeDb({
      selectResults: [[], [inactive], [reactivated]],
    });

    await expect(
      finalizeActiveOrgProviderBinding(db, {
        clerkOrgId: "org_existing",
        connectedByUserId: "user_1",
        provider: "github",
        providerAccountLogin: "lightfast-emulated",
        providerInstallationId: "1001",
      })
    ).resolves.toEqual(reactivated);

    expect(spies.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        activeClerkOrgId: "org_existing",
        connectedByUserId: "user_1",
        providerAccountLogin: "lightfast-emulated",
        revokedAt: null,
        status: "active",
      })
    );
    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("throws ORG_ALREADY_BOUND when duplicate recovery finds a different active installation", async () => {
    const existing = binding({
      clerkOrgId: "org_existing",
      providerInstallationId: "2002",
    });
    const { db } = makeFakeDb({
      insertError: duplicateBindingError(
        "org_source_control_bindings_active_per_org_uq"
      ),
      selectResults: [[], [], [existing], []],
    });

    const error = await finalizeActiveOrgProviderBinding(db, {
      clerkOrgId: "org_existing",
      connectedByUserId: "user_1",
      provider: "github",
      providerInstallationId: "1001",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OrgSourceControlBindingConflictError);
    expect(error).toEqual(
      expect.objectContaining({
        code: "ORG_ALREADY_BOUND",
      })
    );
  });

  it("throws INSTALLATION_ALREADY_BOUND when duplicate recovery finds another org owns the installation", async () => {
    const existingInstallation = binding({
      clerkOrgId: "org_other",
      providerInstallationId: "1001",
    });
    const { db } = makeFakeDb({
      insertError: duplicateBindingError(
        "org_source_control_bindings_installation_uq"
      ),
      selectResults: [[], [], [], [existingInstallation]],
    });

    const error = await finalizeActiveOrgProviderBinding(db, {
      clerkOrgId: "org_new",
      connectedByUserId: "user_1",
      provider: "github",
      providerInstallationId: "1001",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OrgSourceControlBindingConflictError);
    expect(error).toEqual(
      expect.objectContaining({
        code: "INSTALLATION_ALREADY_BOUND",
      })
    );
  });

  it("returns the exact binding when duplicate recovery finds the same org and installation", async () => {
    const existing = binding({
      clerkOrgId: "org_existing",
      providerInstallationId: "1001",
    });
    const { db, spies } = makeFakeDb({
      insertError: duplicateBindingError(
        "org_source_control_bindings_active_per_org_uq"
      ),
      selectResults: [[], [], [existing], [existing]],
    });

    await expect(
      finalizeActiveOrgProviderBinding(db, {
        clerkOrgId: "org_existing",
        connectedByUserId: "user_1",
        provider: "github",
        providerInstallationId: "1001",
      })
    ).resolves.toEqual(existing);

    expect(spies.select).toHaveBeenCalledTimes(4);
  });
});

describe("markOrgBindingRevoked", () => {
  it("returns the rows transitioned to revoked", async () => {
    const active = binding({ clerkOrgId: "org_rev" });
    const revoked = binding({
      ...active,
      revokedAt: new Date("2026-05-26T06:45:00.123Z"),
      status: "revoked",
      updatedAt: new Date("2026-05-26T06:45:00.123Z"),
    });
    const { db, spies } = makeFakeDb({
      selectResults: [[active], [revoked]],
      updateResult: [active],
    });

    const result = await markOrgBindingRevoked(db, { clerkOrgId: "org_rev" });

    expect(result).toEqual([revoked]);
    expect(selectedKeys(spies)).not.toContain("activeClerkOrgId");
    const updateSet = spies.updateSet.mock.calls[0]?.[0] as {
      revokedAt?: unknown;
      updatedAt?: unknown;
    };
    expect(updateSet.revokedAt).toBeInstanceOf(Date);
    expect(updateSet.updatedAt).toBeUndefined();
    expect(spies.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        activeClerkOrgId: null,
        status: "revoked",
        revokedAt: updateSet.revokedAt,
      })
    );
  });

  it("revokes every active binding when drift exceeds 100 rows", async () => {
    const activeRows = Array.from({ length: 101 }, (_, index) =>
      binding({ id: index + 1, clerkOrgId: "org_drift" })
    );
    const revokedRows = activeRows.map((row) =>
      binding({
        ...row,
        revokedAt: new Date("2026-05-26T06:45:00.123Z"),
        status: "revoked",
        updatedAt: new Date("2026-05-26T06:45:00.123Z"),
      })
    );
    const { db, spies } = makeFakeDb({
      selectResults: [activeRows, revokedRows],
      updateResult: activeRows,
    });

    await expect(
      markOrgBindingRevoked(db, { clerkOrgId: "org_drift" })
    ).resolves.toHaveLength(101);
    expect(spies.limit).not.toHaveBeenCalledWith(100);
  });

  it("returns an empty array when the org had no active binding", async () => {
    const { db, spies } = makeFakeDb({ selectResults: [[]] });
    expect(
      await markOrgBindingRevoked(db, { clerkOrgId: "org_empty" })
    ).toEqual([]);
    expect(spies.update).not.toHaveBeenCalled();
  });
});
