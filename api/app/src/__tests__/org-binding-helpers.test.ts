import type { Database, OrgSourceControlBinding } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `@db/app`'s barrel re-exports `db` from `./client`, which eagerly builds a
// Neon client and validates DB env at import. Stub the client module so the
// real binding *helpers* (which only type-import `Database`) load env-free.
vi.mock("@db/app/client", () => ({ db: {} }));

const {
  getActiveOrgBinding,
  isOrgBound,
  upsertActiveOrgBinding,
  markOrgBindingRevoked,
} = await import("@db/app");

/**
 * A minimal stand-in for the Drizzle query slice the binding helpers use.
 *
 * The helpers issue `select().from().where().limit()`,
 * `insert().values().returning()`, and `update().set().where().returning()`.
 * The fake records each terminal call and returns caller-supplied rows, so the
 * tests assert the helpers' *branch logic* — not Drizzle's SQL. The SQL-level
 * `status = 'active'` filter and the one-active-binding-per-org unique index
 * are schema concerns, verified by `pnpm --filter @db/app db:generate`.
 */
interface FakeDbConfig {
  insertResult?: OrgSourceControlBinding[];
  /** One result array per `select()` chain, consumed in order. */
  selectResults?: OrgSourceControlBinding[][];
  updateResult?: OrgSourceControlBinding[];
}

function makeFakeDb(cfg: FakeDbConfig = {}) {
  const selectQueue = [...(cfg.selectResults ?? [])];
  const spies = {
    select: vi.fn(),
    insert: vi.fn(),
    insertValues: vi.fn(),
    update: vi.fn(),
    updateSet: vi.fn(),
  };
  const db = {
    select: () => {
      spies.select();
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(selectQueue.shift() ?? []),
          }),
        }),
      };
    },
    insert: () => {
      spies.insert();
      return {
        values: (v: unknown) => {
          spies.insertValues(v);
          return { returning: () => Promise.resolve(cfg.insertResult ?? []) };
        },
      };
    },
    update: () => {
      spies.update();
      return {
        set: (s: unknown) => {
          spies.updateSet(s);
          return {
            where: () => ({
              returning: () => Promise.resolve(cfg.updateResult ?? []),
            }),
          };
        },
      };
    },
  };
  return { db: db as unknown as Database, spies };
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
    connectedAt: new Date().toISOString(),
    revokedAt: null,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as OrgSourceControlBinding;
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
    const { db } = makeFakeDb({ selectResults: [[binding()]] });
    expect(await isOrgBound(db, "org_bound")).toBe(true);
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
    const { db } = makeFakeDb({ selectResults: [[row]] });
    expect(await getActiveOrgBinding(db, "org_x")).toEqual(row);
  });

  it("returns undefined when the org is not bound", async () => {
    const { db } = makeFakeDb({ selectResults: [[]] });
    expect(await getActiveOrgBinding(db, "org_x")).toBeUndefined();
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
    // The application-level half of "one active binding per org": a second
    // bind never inserts a competing active row.
    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("inserts a new active binding when the org has none", async () => {
    const inserted = binding({ id: 99, clerkOrgId: "org_new" });
    const { db, spies } = makeFakeDb({
      selectResults: [[]],
      insertResult: [inserted],
    });

    const result = await upsertActiveOrgBinding(db, {
      clerkOrgId: "org_new",
      connectedByUserId: "user_3",
      provider: "github",
    });

    expect(result).toEqual(inserted);
    expect(spies.insert).toHaveBeenCalledTimes(1);
    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_new",
        connectedByUserId: "user_3",
        provider: "github",
        status: "active",
        // No provider ids supplied → stored as null, never a fake value.
        providerAccountId: null,
        providerAccountLogin: null,
        providerInstallationId: null,
      })
    );
  });

  it("throws when the insert returns no row", async () => {
    const { db } = makeFakeDb({ selectResults: [[]], insertResult: [] });

    await expect(
      upsertActiveOrgBinding(db, {
        clerkOrgId: "org_fail",
        connectedByUserId: "user_4",
        provider: "github",
      })
    ).rejects.toThrow(/Failed to insert active binding/);
  });
});

describe("markOrgBindingRevoked", () => {
  it("returns the rows transitioned to revoked", async () => {
    const revoked = binding({ clerkOrgId: "org_rev", status: "revoked" });
    const { db, spies } = makeFakeDb({ updateResult: [revoked] });

    const result = await markOrgBindingRevoked(db, { clerkOrgId: "org_rev" });

    expect(result).toEqual([revoked]);
    expect(spies.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "revoked",
        revokedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    );
  });

  it("returns an empty array when the org had no active binding", async () => {
    const { db } = makeFakeDb({ updateResult: [] });
    expect(
      await markOrgBindingRevoked(db, { clerkOrgId: "org_empty" })
    ).toEqual([]);
  });
});
