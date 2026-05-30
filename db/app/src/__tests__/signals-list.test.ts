import type { Database, Signal } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import {
  createSignal,
  listSignals,
  listWorkspaceSignals,
} from "../utils/signals";

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 1,
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    createdByApiKeyId: "key_test",
    createdByUserId: "user_test",
    input: "Customer asked for migration help",
    status: "classified",
    classification: {
      schemaVersion: "signal.classification.v1",
      confidence: 0.91,
      disposition: "actionable",
      kind: "follow_up",
      nextAction: "Reply with migration plan",
      priority: "high",
      rationale: "The customer is asking for help.",
      summary: "Customer asked for migration help.",
      title: "Follow up on migration",
    },
    errorCode: null,
    errorMessage: null,
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    updatedAt: new Date("2026-05-27T01:01:00.000Z"),
    ...overrides,
  };
}

function makeListDb(rows: Signal[]) {
  const spies = {
    limit: vi.fn((value: number) => Promise.resolve(rows.slice(0, value))),
    orderBy: vi.fn(),
    where: vi.fn(),
  };
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          return {
            orderBy: (...order: unknown[]) => {
              spies.orderBy(...order);
              return {
                limit: spies.limit,
              };
            },
          };
        },
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

function makeCreateDb() {
  let inserted: Partial<Signal> | null = null;

  const spies = {
    values: vi.fn(async (value: Partial<Signal>) => {
      inserted = value;
    }),
    where: vi.fn(),
    limit: vi.fn(() =>
      Promise.resolve(
        inserted
          ? [
              makeSignal({
                ...inserted,
                id: 11,
                createdAt: new Date("2026-05-27T03:00:00.000Z"),
                updatedAt: new Date("2026-05-27T03:00:00.000Z"),
              }),
            ]
          : []
      )
    ),
  };

  const db = {
    insert: () => ({
      values: spies.values,
    }),
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          return {
            limit: spies.limit,
          };
        },
      }),
    }),
  };

  return { db: db as unknown as Database, spies };
}

describe("listSignals", () => {
  it("returns newest-first signal rows with a next cursor when more rows exist", async () => {
    const rows = [
      makeSignal({
        id: 3,
        publicId: "signal_333e4567-e89b-12d3-a456-426614174000",
      }),
      makeSignal({
        id: 2,
        publicId: "signal_222e4567-e89b-12d3-a456-426614174000",
      }),
      makeSignal({
        id: 1,
        publicId: "signal_111e4567-e89b-12d3-a456-426614174000",
      }),
    ];
    const { db, spies } = makeListDb(rows);

    await expect(
      listSignals(db, { clerkOrgId: "org_test", limit: 2 })
    ).resolves.toEqual({
      items: rows.slice(0, 2),
      nextCursor: { createdAt: rows[1]!.createdAt, id: rows[1]!.id },
    });
    expect(spies.limit).toHaveBeenCalledWith(3);
    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.orderBy).toHaveBeenCalled();
  });

  it("returns null next cursor when no extra row exists", async () => {
    const rows = [makeSignal({ id: 1 })];
    const { db } = makeListDb(rows);

    await expect(
      listSignals(db, { clerkOrgId: "org_test", limit: 2 })
    ).resolves.toEqual({
      items: rows,
      nextCursor: null,
    });
  });

  it("bounds the requested limit to 100 rows", async () => {
    const { db, spies } = makeListDb([]);

    await listSignals(db, { clerkOrgId: "org_test", limit: 500 });

    expect(spies.limit).toHaveBeenCalledWith(101);
  });
});

describe("createSignal", () => {
  it("creates a queued signal without an API key id", async () => {
    const { db, spies } = makeCreateDb();

    await expect(
      createSignal(db, {
        clerkOrgId: "org_test",
        createdByApiKeyId: null,
        createdByUserId: "user_test",
        input: "Create a user-facing signal",
      })
    ).resolves.toMatchObject({
      clerkOrgId: "org_test",
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      input: "Create a user-facing signal",
      status: "queued",
    });

    expect(spies.values).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        createdByApiKeyId: null,
        createdByUserId: "user_test",
        input: "Create a user-facing signal",
        status: "queued",
      })
    );
  });
});

interface ProjectedRow {
  classification: Signal["classification"];
  createdAt: Date;
  createdByApiKeyId: string | null;
  createdByUserId: string;
  id: number;
  publicId: string;
  status: Signal["status"];
}

function makeProjectedRow(overrides: Partial<ProjectedRow> = {}): ProjectedRow {
  return {
    classification: {
      schemaVersion: "signal.classification.v1",
      confidence: 0.9,
      disposition: "actionable",
      kind: "follow_up",
      nextAction: "Reply with the plan",
      priority: "high",
      rationale: "Customer needs help.",
      summary: "Customer wants migration help.",
      title: "Follow up on migration",
    },
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    createdByApiKeyId: "key_test",
    createdByUserId: "user_test",
    id: 1,
    publicId: "signal_111e4567-e89b-12d3-a456-426614174000",
    status: "classified",
    ...overrides,
  };
}

function makeWorkspaceDb(rows: ProjectedRow[], totalCount?: number) {
  const spies = { limit: vi.fn(), orderBy: vi.fn(), where: vi.fn() };
  const db = {
    select: (projection: Record<string, unknown>) => {
      const isCount = "value" in projection;
      return {
        from: () => ({
          where: (condition: unknown) => {
            spies.where(condition);
            if (isCount) {
              return Promise.resolve([{ value: totalCount ?? rows.length }]);
            }
            return {
              orderBy: (...order: unknown[]) => {
                spies.orderBy(...order);
                return {
                  limit: (value: number) => {
                    spies.limit(value);
                    return Promise.resolve(rows.slice(0, value));
                  },
                };
              },
            };
          },
        }),
      };
    },
  };
  return { db: db as unknown as Database, spies };
}

describe("listWorkspaceSignals", () => {
  it("projects working-set fields and strips rationale/nextAction", async () => {
    const { db } = makeWorkspaceDb([makeProjectedRow()]);

    const result = await listWorkspaceSignals(db, { clerkOrgId: "org_test" });

    expect(result.limit).toBe(2000);
    expect(result.windowDays).toBe(30);
    expect(result.truncated).toBe(false);
    expect(result.totalCount).toBe(1);
    const item = result.items[0]!;
    expect(item.classification).toMatchObject({
      disposition: "actionable",
      kind: "follow_up",
      priority: "high",
      summary: "Customer wants migration help.",
      title: "Follow up on migration",
    });
    expect(item.classification).not.toHaveProperty("rationale");
    expect(item.classification).not.toHaveProperty("nextAction");
    expect(item).not.toHaveProperty("input");
  });

  it("requests cap + 1 rows and does not count when within the cap", async () => {
    const { db, spies } = makeWorkspaceDb([makeProjectedRow()]);

    await listWorkspaceSignals(db, { clerkOrgId: "org_test" });

    expect(spies.limit).toHaveBeenCalledWith(2001);
    expect(spies.where).toHaveBeenCalledTimes(1); // list only, no count
  });

  it("truncates to the cap and reports totalCount when the window overflows", async () => {
    const overflow = Array.from({ length: 2001 }, (_, index) =>
      makeProjectedRow({ id: index + 1 })
    );
    const { db, spies } = makeWorkspaceDb(overflow, 2500);

    const result = await listWorkspaceSignals(db, { clerkOrgId: "org_test" });

    expect(result.limit).toBe(2000);
    expect(result.windowDays).toBe(30);
    expect(result.items).toHaveLength(2000);
    expect(result.truncated).toBe(true);
    expect(result.totalCount).toBe(2500);
    expect(spies.where).toHaveBeenCalledTimes(2); // list + count
  });

  it("keeps a null classification null", async () => {
    const { db } = makeWorkspaceDb([
      makeProjectedRow({ classification: null }),
    ]);

    const result = await listWorkspaceSignals(db, { clerkOrgId: "org_test" });

    expect(result.items[0]!.classification).toBeNull();
  });
});
