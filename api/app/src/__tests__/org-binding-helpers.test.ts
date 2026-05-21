import type { Database, OrgSourceControlBinding } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `@db/app`'s barrel re-exports `db` from `./client`, which eagerly builds a
// database client and validates DB env at import. Stub the client module so the
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
 * `insert().values().$returningId()`, and `update().set().where()`.
 * The fake records each terminal call and returns caller-supplied rows, so the
 * tests assert the helpers' *branch logic* — not Drizzle's SQL. The SQL-level
 * `status = 'active'` filter and the one-active-binding-per-org unique key
 * are schema concerns, verified by `pnpm --filter @db/app db:generate`.
 */
interface FakeDbConfig {
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
    update: vi.fn(),
    updateSet: vi.fn(),
  };
  const db = {
    select: (fields?: unknown) => {
      spies.select(fields);
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
          return {
            $returningId: () => Promise.resolve([{ id: cfg.insertId ?? 1 }]),
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
});

describe("markOrgBindingRevoked", () => {
  it("returns the rows transitioned to revoked", async () => {
    const active = binding({ clerkOrgId: "org_rev" });
    const { db, spies } = makeFakeDb({
      selectResults: [[active]],
      updateResult: [active],
    });

    const result = await markOrgBindingRevoked(db, { clerkOrgId: "org_rev" });

    expect(result).toEqual([
      expect.objectContaining({
        clerkOrgId: "org_rev",
        revokedAt: expect.any(String),
        status: "revoked",
        updatedAt: expect.any(String),
      }),
    ]);
    expect(selectedKeys(spies)).not.toContain("activeClerkOrgId");
    expect(spies.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        activeClerkOrgId: null,
        status: "revoked",
        revokedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    );
  });

  it("returns an empty array when the org had no active binding", async () => {
    const { db, spies } = makeFakeDb({ selectResults: [[]] });
    expect(
      await markOrgBindingRevoked(db, { clerkOrgId: "org_empty" })
    ).toEqual([]);
    expect(spies.update).not.toHaveBeenCalled();
  });
});
