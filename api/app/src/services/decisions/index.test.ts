import type { Database, ProviderRoutineCall } from "@db/app";
import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";
import { decisionSearchTerms, findDecisions, getDecision } from "./index";

const startedAt = new Date("2026-06-25T00:00:00.000Z");
const finishedAt = new Date("2026-06-25T00:00:05.000Z");

function makeCall(
  overrides: Partial<ProviderRoutineCall> = {}
): ProviderRoutineCall {
  return {
    calledById: "automation_run_123",
    calledByKind: "automation",
    calledByUserId: null,
    clerkOrgId: "org_123",
    createdAt: startedAt,
    errorCode: null,
    errorMessage: null,
    finishedAt,
    id: 1,
    inputPayload: { present: true },
    legacyInputRedacted: null,
    legacyOutputRedacted: null,
    outputPayload: { present: true },
    provider: "linear",
    providerActorId: "actor_123",
    providerAttempted: true,
    providerConnectionId: 42,
    providerToolName: "create_issue",
    providerWorkspaceId: "workspace_123",
    publicId: "provider_routine_call_123",
    routineId: "linear__create_issue",
    sourceClientId: null,
    sourceRef: "automation_run_123",
    sourceSurface: "automation",
    startedAt,
    status: "succeeded",
    updatedAt: finishedAt,
    ...overrides,
  };
}

function listRows(rows: ProviderRoutineCall[]) {
  const spies = {
    limit: vi.fn((limit: number) => Promise.resolve(rows.slice(0, limit))),
    orderBy: vi.fn((..._orderExpressions: unknown[]) => ({
      limit: spies.limit,
    })),
    where: vi.fn((_condition: unknown) => ({
      orderBy: spies.orderBy,
    })),
  };

  return {
    query: {
      from: () => ({
        where: spies.where,
      }),
    },
    spies,
  };
}

function selectRows(rows: ProviderRoutineCall[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  };
}

describe("Decision Module", () => {
  it("normalizes decision search terms without preserving duplicates", () => {
    expect(decisionSearchTerms(" linear/create create  issue ")).toEqual([
      "linear",
      "create",
      "issue",
    ]);
  });

  it("finds compact decisions and keeps payloads out of search output", async () => {
    const row = makeCall();
    const { query, spies } = listRows([row]);
    const db = { select: vi.fn(() => query) } as unknown as Database;

    await expect(
      findDecisions(db, {
        clerkOrgId: "org_123",
        limit: 1,
        query: "linear create",
        sourceSurfaces: ["automation"],
      })
    ).resolves.toEqual({
      items: [
        {
          calledById: "automation_run_123",
          calledByKind: "automation",
          calledByUserId: null,
          classification: "write",
          createdAt: startedAt,
          errorCode: null,
          errorMessage: null,
          finishedAt,
          id: "provider_routine_call_123",
          provider: "linear",
          providerToolName: "create_issue",
          routineId: "linear__create_issue",
          snippet: "Linear / Create Issue succeeded from Automation",
          sourceSurface: "automation",
          startedAt,
          status: "succeeded",
          title: "Create Issue",
        },
      ],
      nextCursor: null,
    });

    expect(spies.limit).toHaveBeenCalledWith(2);
    const condition = spies.where.mock.calls[0]?.[0] as SQL;
    const compiled = new MySqlDialect().sqlToQuery(condition);
    expect(compiled.sql).toContain("like ? escape '\\\\'");
    expect(compiled.params).toContain("%linear%");
    expect(compiled.params).toContain("%create%");
  });

  it("escapes wildcard characters in query terms", async () => {
    const { query, spies } = listRows([]);
    const db = { select: vi.fn(() => query) } as unknown as Database;

    await findDecisions(db, {
      clerkOrgId: "org_123",
      query: String.raw`50%_done\soon`,
    });

    const condition = spies.where.mock.calls[0]?.[0] as SQL;
    const compiled = new MySqlDialect().sqlToQuery(condition);
    expect(compiled.params).toContain(String.raw`%50\%\_done\\soon%`);
  });

  it("gets a full decision detail record", async () => {
    const row = makeCall();
    const db = {
      select: vi.fn(() => selectRows([row])),
    } as unknown as Database;

    await expect(
      getDecision(db, {
        clerkOrgId: "org_123",
        id: "provider_routine_call_123",
      })
    ).resolves.toMatchObject({
      id: "provider_routine_call_123",
      inputRedacted: { present: true },
      outputRedacted: { present: true },
      providerConnectionId: 42,
      providerRoutineCallId: "provider_routine_call_123",
      title: "Create Issue",
    });
  });
});
