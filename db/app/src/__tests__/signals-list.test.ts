import type { Database, Signal } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import { listSignals } from "../utils/signals";

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
