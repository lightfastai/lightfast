import type { Database, Signal } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import {
  createSignal,
  getVisibleSignalByPublicId,
  listSignals,
  listWorkspaceSignals,
  markSignalClassified,
} from "../utils/signals";

function makeClassification(): NonNullable<Signal["classification"]> {
  return {
    schemaVersion: "signal.classification.v2",
    confidence: 0.91,
    disposition: "actionable",
    kind: "follow_up",
    nextAction: "Reply with migration plan",
    priority: "high",
    rationale: "The customer is asking for help.",
    routing: {
      visibility: {
        scope: "team",
        rationale: "The signal is relevant to the team.",
      },
      review: {
        required: false,
        reason: null,
        rationale: null,
      },
      routes: {
        people: {
          shouldRun: false,
          confidence: 0.9,
          rationale: "No durable identity is present.",
        },
      },
    },
    summary: "Customer asked for migration help.",
    title: "Follow up on migration",
  };
}

function makeClassificationWithVisibility(
  scope: Signal["visibilityScope"]
): NonNullable<Signal["classification"]> {
  const classification = makeClassification();
  return {
    ...classification,
    routing: {
      ...classification.routing,
      review:
        scope === "needs_review"
          ? {
              required: true,
              reason: "ambiguous_scope",
              rationale: "The signal needs manual review.",
            }
          : classification.routing.review,
      visibility: {
        ...classification.routing.visibility,
        scope,
      },
    },
  };
}

function makeLegacyClassification() {
  return {
    schemaVersion: "signal.classification.v1",
    confidence: 0.86,
    disposition: "actionable",
    kind: "engage",
    nextAction: "Review the profile and decide whether to reply.",
    priority: "normal",
    rationale: "The input contains a durable social identity.",
    routing: {
      classifyPeople: {
        shouldRun: true,
        rationale: "The input includes a durable social identity.",
      },
    },
    summary: "The signal mentions an X profile worth engaging.",
    title: "Talk to Jeevan",
  } as unknown as NonNullable<Signal["classification"]>;
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 1,
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    createdByApiKeyId: "key_test",
    createdByUserId: "user_test",
    visibilityScope: "team",
    input: "Customer asked for migration help",
    status: "classified",
    classification: makeClassification(),
    classificationMetadata: null,
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

function getChunkText(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }
  const chunk = value as { value?: unknown };
  return Array.isArray(chunk.value) ? chunk.value.join("") : "";
}

function isColumnChunk(value: unknown): value is { name: string } {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { columnType?: unknown }).columnType === "string" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

function isParamChunk(value: unknown): value is { value: unknown } {
  return (
    !!value &&
    typeof value === "object" &&
    "value" in value &&
    !Array.isArray((value as { value?: unknown }).value)
  );
}

const signalColumnToProperty = {
  clerk_org_id: "clerkOrgId",
  created_by_user_id: "createdByUserId",
  public_id: "publicId",
  visibility_scope: "visibilityScope",
} as const satisfies Record<string, keyof Signal>;

function evaluateVisibleReadPredicate(
  condition: unknown,
  row: Signal
): boolean {
  if (!condition || typeof condition !== "object") {
    return false;
  }

  const chunks = (condition as { queryChunks?: unknown }).queryChunks;
  if (!Array.isArray(chunks)) {
    return false;
  }

  const text = chunks.map(getChunkText).join("");
  if (text.includes("$.schemaVersion")) {
    return (
      (row.classification as { schemaVersion?: unknown } | null)
        ?.schemaVersion === "signal.classification.v1"
    );
  }
  if (text.includes("$.routing.classifyPeople.shouldRun")) {
    return (
      (
        row.classification as {
          routing?: { classifyPeople?: { shouldRun?: unknown } };
        } | null
      )?.routing?.classifyPeople?.shouldRun === true
    );
  }

  const column = chunks.find(isColumnChunk);
  const param = chunks.find(isParamChunk);
  const isEquality = chunks.some((chunk) => getChunkText(chunk).includes("="));
  if (column && param && isEquality) {
    const property =
      signalColumnToProperty[
        column.name as keyof typeof signalColumnToProperty
      ];
    return property ? row[property] === param.value : false;
  }

  const values: boolean[] = [];
  const operators: Array<"and" | "or"> = [];
  for (const chunk of chunks) {
    const text = getChunkText(chunk);
    if (text.includes(" and ")) {
      operators.push("and");
      continue;
    }
    if (text.includes(" or ")) {
      operators.push("or");
      continue;
    }
    if (
      chunk &&
      typeof chunk === "object" &&
      Array.isArray((chunk as { queryChunks?: unknown }).queryChunks)
    ) {
      values.push(evaluateVisibleReadPredicate(chunk, row));
    }
  }

  if (values.length === 0) {
    return false;
  }

  return values.slice(1).reduce((result, value, index) => {
    const operator = operators[index] ?? "and";
    return operator === "or" ? result || value : result && value;
  }, values[0]!);
}

function makeVisibleReadDb(rows: Signal[]) {
  const spies = {
    limit: vi.fn(),
    where: vi.fn(),
  };
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          const matchingRows = rows.filter((row) =>
            evaluateVisibleReadPredicate(condition, row)
          );
          return {
            limit: (value: number) => {
              spies.limit(value);
              return Promise.resolve(matchingRows.slice(0, value));
            },
          };
        },
      }),
    }),
  };

  return { db: db as unknown as Database, spies };
}

function makeUpdateDb() {
  let updated: Partial<Signal> | null = null;

  const spies = {
    set: vi.fn((value: Partial<Signal>) => {
      updated = value;
      return {
        where: vi.fn(() => Promise.resolve({ rowsAffected: 1 })),
      };
    }),
  };

  const db = {
    update: () => ({
      set: spies.set,
    }),
  };

  return { db: db as unknown as Database, spies, getUpdated: () => updated };
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
      listSignals(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        limit: 2,
      })
    ).resolves.toEqual({
      items: rows.slice(0, 2),
      nextCursor: { createdAt: rows[1]!.createdAt, id: rows[1]!.id },
    });
    expect(spies.limit).toHaveBeenCalledWith(500);
    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.orderBy).toHaveBeenCalled();
  });

  it("returns null next cursor when no extra row exists", async () => {
    const rows = [makeSignal({ id: 1 })];
    const { db } = makeListDb(rows);

    await expect(
      listSignals(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        limit: 2,
      })
    ).resolves.toEqual({
      items: rows,
      nextCursor: null,
    });
  });

  it("bounds the requested limit to 100 visible rows", async () => {
    const rows = Array.from({ length: 101 }, (_, index) =>
      makeSignal({ id: 101 - index })
    );
    const { db } = makeListDb(rows);

    const result = await listSignals(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      limit: 500,
    });

    expect(result.items).toHaveLength(100);
    expect(result.nextCursor).toEqual({
      createdAt: result.items[99]!.createdAt,
      id: result.items[99]!.id,
    });
  });

  it("filters list rows to signals visible to the current user", async () => {
    const visibleTeam = makeSignal({
      id: 3,
      createdByUserId: "user_other",
      visibilityScope: "team",
    });
    const hiddenUserScoped = makeSignal({
      classification: makeClassificationWithVisibility("user"),
      id: 2,
      createdByUserId: "user_other",
      visibilityScope: "user",
    });
    const visibleOwn = makeSignal({
      classification: makeClassificationWithVisibility("user"),
      id: 1,
      createdByUserId: "user_test",
      visibilityScope: "user",
    });
    const { db } = makeListDb([visibleTeam, hiddenUserScoped, visibleOwn]);

    await expect(
      listSignals(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
      })
    ).resolves.toEqual({
      items: [visibleTeam, visibleOwn],
      nextCursor: null,
    });
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
        visibilityScope: "user",
      })
    );
  });
});

describe("getVisibleSignalByPublicId", () => {
  it("returns undefined when no visible signal matches", async () => {
    const { db } = makeCreateDb();

    await expect(
      getVisibleSignalByPublicId(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: "signal_missing",
      })
    ).resolves.toBeUndefined();
  });

  it.each([
    {
      name: "returns own user-scoped row",
      row: makeSignal({
        classification: makeClassificationWithVisibility("user"),
        createdByUserId: "user_test",
        visibilityScope: "user",
      }),
      expectedVisible: true,
    },
    {
      name: "hides another user's user-scoped row",
      row: makeSignal({
        classification: makeClassificationWithVisibility("user"),
        createdByUserId: "user_other",
        visibilityScope: "user",
      }),
      expectedVisible: false,
    },
    {
      name: "returns another user's team-scoped row",
      row: makeSignal({
        createdByUserId: "user_other",
        visibilityScope: "team",
      }),
      expectedVisible: true,
    },
    {
      name: "returns own needs-review row",
      row: makeSignal({
        classification: makeClassificationWithVisibility("needs_review"),
        createdByUserId: "user_test",
        visibilityScope: "needs_review",
      }),
      expectedVisible: true,
    },
    {
      name: "hides another user's needs-review row",
      row: makeSignal({
        classification: makeClassificationWithVisibility("needs_review"),
        createdByUserId: "user_other",
        visibilityScope: "needs_review",
      }),
      expectedVisible: false,
    },
  ])("$name", async ({ row, expectedVisible }) => {
    const { db, spies } = makeVisibleReadDb([row]);

    await expect(
      getVisibleSignalByPublicId(db, {
        clerkOrgId: row.clerkOrgId,
        createdByUserId: "user_test",
        publicId: row.publicId,
      })
    ).resolves.toBe(expectedVisible ? row : undefined);

    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.limit).toHaveBeenCalledWith(1);
  });

  it("returns a legacy people-routed row with defaulted user visibility", async () => {
    const row = makeSignal({
      classification: makeLegacyClassification(),
      createdByUserId: "user_other",
      visibilityScope: "user",
    });
    const { db } = makeVisibleReadDb([row]);

    const result = await getVisibleSignalByPublicId(db, {
      clerkOrgId: row.clerkOrgId,
      createdByUserId: "user_test",
      publicId: row.publicId,
    });

    expect(result).toMatchObject({
      classification: {
        schemaVersion: "signal.classification.v2",
        routing: {
          visibility: { scope: "team" },
          routes: { people: { shouldRun: true } },
        },
      },
      visibilityScope: "team",
    });
  });

  it("normalizes a visible legacy classification before returning a detail row", async () => {
    const row = makeSignal({
      classification: makeLegacyClassification(),
      visibilityScope: "team",
    });
    const { db } = makeVisibleReadDb([row]);

    const result = await getVisibleSignalByPublicId(db, {
      clerkOrgId: row.clerkOrgId,
      createdByUserId: "user_test",
      publicId: row.publicId,
    });

    expect(result?.classification).toMatchObject({
      schemaVersion: "signal.classification.v2",
      routing: {
        visibility: { scope: "team" },
        routes: { people: { shouldRun: true } },
      },
    });
    expect(result?.visibilityScope).toBe("team");
  });
});

describe("markSignalClassified", () => {
  it("persists visibility scope from classification routing", async () => {
    const { db, spies } = makeUpdateDb();
    const classification = makeClassification();

    await expect(
      markSignalClassified(db, {
        clerkOrgId: "org_test",
        publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
        classification,
      })
    ).resolves.toBe(true);

    expect(spies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        classification,
        errorCode: null,
        errorMessage: null,
        status: "classified",
        visibilityScope: "team",
      })
    );
  });

  it("persists workflow-owned classification metadata when supplied", async () => {
    const { db, spies } = makeUpdateDb();
    const classification = makeClassification();
    const classificationMetadata = {
      organizationIdentity: {
        surface: "signal" as const,
        includedFiles: [
          {
            kind: "identity" as const,
            path: "IDENTITY.md",
            status: "present" as const,
            contentHash: "sha256:abc",
            commitSha: "commit-sha",
          },
        ],
        diagnostics: [],
        systemSectionHash: "sha256:def",
      },
    };

    await expect(
      markSignalClassified(db, {
        clerkOrgId: "org_test",
        publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
        classification,
        classificationMetadata,
      })
    ).resolves.toBe(true);

    expect(spies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        classification,
        classificationMetadata,
        status: "classified",
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
  visibilityScope: Signal["visibilityScope"];
}

function makeProjectedRow(overrides: Partial<ProjectedRow> = {}): ProjectedRow {
  return {
    classification: {
      ...makeClassification(),
      confidence: 0.9,
      nextAction: "Reply with the plan",
      rationale: "Customer needs help.",
      summary: "Customer wants migration help.",
    },
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    createdByApiKeyId: "key_test",
    createdByUserId: "user_test",
    id: 1,
    publicId: "signal_111e4567-e89b-12d3-a456-426614174000",
    status: "classified",
    visibilityScope: "team",
    ...overrides,
  };
}

function makeWorkspaceDb(rows: ProjectedRow[]) {
  let offset = 0;
  const spies = { limit: vi.fn(), orderBy: vi.fn(), where: vi.fn() };
  const db = {
    select: (_projection: Record<string, unknown>) => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          return {
            orderBy: (...order: unknown[]) => {
              spies.orderBy(...order);
              return {
                limit: (value: number) => {
                  spies.limit(value);
                  const batch = rows.slice(offset, offset + value);
                  offset += value;
                  return Promise.resolve(batch);
                },
              };
            },
          };
        },
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

describe("listWorkspaceSignals", () => {
  it("projects working-set fields and strips rationale/nextAction", async () => {
    const { db } = makeWorkspaceDb([makeProjectedRow()]);

    const result = await listWorkspaceSignals(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });

    expect(result.truncated).toBe(false);
    expect(result.limit).toBe(2000);
    expect(result.totalCount).toBe(1);
    expect(result.windowDays).toBe(30);
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

    await listWorkspaceSignals(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });

    expect(spies.limit).toHaveBeenCalledWith(2001);
    expect(spies.where).toHaveBeenCalledTimes(1); // list only, no count
  });

  it("filters workspace rows to signals visible to the current user", async () => {
    const visibleTeam = makeProjectedRow({
      id: 3,
      createdByUserId: "user_other",
      visibilityScope: "team",
    });
    const hiddenUserScoped = makeProjectedRow({
      classification: makeClassificationWithVisibility("user"),
      id: 2,
      createdByUserId: "user_other",
      visibilityScope: "user",
    });
    const visibleOwn = makeProjectedRow({
      classification: makeClassificationWithVisibility("user"),
      id: 1,
      createdByUserId: "user_test",
      visibilityScope: "user",
    });
    const { db, spies } = makeWorkspaceDb([
      visibleTeam,
      hiddenUserScoped,
      visibleOwn,
    ]);

    const result = await listWorkspaceSignals(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });

    expect(result.items.map((item) => item.id)).toEqual([3, 1]);
    expect(result.totalCount).toBe(2);
    expect(spies.where).toHaveBeenCalledTimes(1);
  });

  it("truncates to the cap and reports totalCount when the window overflows", async () => {
    const overflow = Array.from({ length: 2500 }, (_, index) =>
      makeProjectedRow({ id: index + 1 })
    );
    const { db, spies } = makeWorkspaceDb(overflow);

    const result = await listWorkspaceSignals(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });

    expect(result.limit).toBe(2000);
    expect(result.items).toHaveLength(2000);
    expect(result.truncated).toBe(true);
    expect(result.totalCount).toBe(2500);
    expect(result.windowDays).toBe(30);
    expect(spies.where).toHaveBeenCalledTimes(2);
  });

  it("keeps a null classification null", async () => {
    const { db } = makeWorkspaceDb([
      makeProjectedRow({ classification: null }),
    ]);

    const result = await listWorkspaceSignals(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });

    expect(result.items[0]!.classification).toBeNull();
  });

  it("normalizes legacy classifications in projected workspace rows", async () => {
    const { db } = makeWorkspaceDb([
      makeProjectedRow({ classification: makeLegacyClassification() }),
    ]);

    const result = await listWorkspaceSignals(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });

    expect(result.items[0]!.classification).toMatchObject({
      schemaVersion: "signal.classification.v2",
      routing: {
        visibility: { scope: "team" },
        routes: { people: { shouldRun: true } },
      },
    });
    expect(result.items[0]!.classification).not.toHaveProperty("rationale");
    expect(result.items[0]!.classification).not.toHaveProperty("nextAction");
  });
});
