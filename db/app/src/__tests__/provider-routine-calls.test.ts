import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../client";
import {
  createProviderRoutineCall,
  listProviderRoutineCalls,
  markProviderRoutineCallFailed,
  markProviderRoutineCallProviderAttempted,
  markProviderRoutineCallSucceeded,
} from "../utils/provider-routine-calls";

const startedAt = new Date("2026-06-02T00:00:00.000Z");
const finishedAt = new Date("2026-06-02T00:01:00.000Z");

function makeCall(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    publicId: "provider_routine_call_1",
    clerkOrgId: "org_123",
    calledByKind: "automation",
    calledById: "run_1",
    calledByUserId: null,
    provider: "linear",
    routineId: "linear__create_issue",
    providerToolName: "create_issue",
    providerConnectionId: 42,
    providerWorkspaceId: "workspace_1",
    providerActorId: "actor_1",
    providerAttempted: true,
    sourceClientId: null,
    sourceRef: "run_1",
    sourceSurface: "automation",
    status: "succeeded",
    inputPayload: { title: "Bug" },
    legacyInputRedacted: { present: true },
    legacyOutputRedacted: { present: true },
    outputPayload: { content: [{ text: "Created" }] },
    errorCode: null,
    errorMessage: null,
    startedAt,
    finishedAt,
    createdAt: finishedAt,
    updatedAt: finishedAt,
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

function listRows<T>(rows: T[]) {
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

describe("provider routine call helpers", () => {
  describe("listProviderRoutineCalls", () => {
    it("returns rows with keyset cursor pagination", async () => {
      const rows = [
        makeCall({ id: 3, publicId: "provider_routine_call_3" }),
        makeCall({ id: 2, publicId: "provider_routine_call_2" }),
        makeCall({ id: 1, publicId: "provider_routine_call_1" }),
      ];
      const { query, spies } = listRows(rows);
      const db = { select: vi.fn(() => query) } as unknown as Database;

      await expect(
        listProviderRoutineCalls(db, { clerkOrgId: "org_123", limit: 2 })
      ).resolves.toEqual({
        items: rows.slice(0, 2),
        nextCursor: { createdAt: rows[1]!.createdAt, id: rows[1]!.id },
      });

      expect(spies.where).toHaveBeenCalledOnce();
      expect(spies.orderBy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything()
      );
      expect(spies.limit).toHaveBeenCalledWith(3);
    });

    it("returns a null cursor on the last page", async () => {
      const rows = [makeCall({ id: 1 })];
      const { query, spies } = listRows(rows);
      const db = { select: vi.fn(() => query) } as unknown as Database;

      await expect(
        listProviderRoutineCalls(db, { clerkOrgId: "org_123", limit: 2 })
      ).resolves.toEqual({ items: rows, nextCursor: null });
      expect(spies.limit).toHaveBeenCalledWith(3);
    });

    it("bounds limits to 100 rows", async () => {
      const { query, spies } = listRows([]);
      const db = { select: vi.fn(() => query) } as unknown as Database;

      await listProviderRoutineCalls(db, { clerkOrgId: "org_123", limit: 500 });
      expect(spies.limit).toHaveBeenCalledWith(101);
    });

    it("escapes MySQL LIKE wildcards in search input", async () => {
      const { query, spies } = listRows([]);
      const db = { select: vi.fn(() => query) } as unknown as Database;

      await listProviderRoutineCalls(db, {
        clerkOrgId: "org_123",
        search: String.raw`50%_done\soon`,
      });

      const condition = spies.where.mock.calls[0]?.[0] as SQL;
      const compiled = new MySqlDialect().sqlToQuery(condition);
      expect(compiled.sql).toContain("like ? escape '\\\\'");
      expect(compiled.params).toContain(String.raw`%50\%\_done\\soon%`);
    });

    it("passes provider and status filters without throwing", async () => {
      const row = makeCall();
      const { query, spies } = listRows([row]);
      const db = { select: vi.fn(() => query) } as unknown as Database;

      await expect(
        listProviderRoutineCalls(db, {
          clerkOrgId: "org_123",
          providers: ["linear", "x"],
          statuses: ["failed"],
          limit: 10,
        })
      ).resolves.toEqual({ items: [row], nextCursor: null });

      expect(spies.where).toHaveBeenCalledOnce();
      expect(spies.limit).toHaveBeenCalledWith(11);
    });

    it("ignores empty filter arrays", async () => {
      const { query, spies } = listRows([]);
      const db = { select: vi.fn(() => query) } as unknown as Database;

      await listProviderRoutineCalls(db, {
        clerkOrgId: "org_123",
        providers: [],
        statuses: [],
        limit: 10,
      });
      expect(spies.where).toHaveBeenCalledOnce();
    });

    it("falls back to legacy redacted columns while the rename is rolling out", async () => {
      const row = makeCall({
        inputPayload: null,
        legacyInputRedacted: { title: "Legacy input" },
        legacyOutputRedacted: { content: [{ text: "Legacy output" }] },
        outputPayload: null,
      });
      const { query } = listRows([row]);
      const db = { select: vi.fn(() => query) } as unknown as Database;

      await expect(
        listProviderRoutineCalls(db, { clerkOrgId: "org_123" })
      ).resolves.toEqual({
        items: [
          {
            ...row,
            inputPayload: { title: "Legacy input" },
            outputPayload: { content: [{ text: "Legacy output" }] },
          },
        ],
        nextCursor: null,
      });
    });
  });

  it("creates running provider routine calls with a generated public id", async () => {
    const inserted = {
      id: 1,
      publicId: "provider_routine_call_123e4567-e89b-12d3-a456-426614174000",
      clerkOrgId: "org_123",
      calledByKind: "automation",
      calledById: "run_123",
      calledByUserId: null,
      provider: "linear",
      routineId: "linear__create_issue",
      providerToolName: "create_issue",
      providerConnectionId: 42,
      providerWorkspaceId: "workspace_123",
      providerActorId: "actor_123",
      providerAttempted: false,
      sourceClientId: null,
      sourceRef: "run_123",
      sourceSurface: "automation",
      status: "running",
      inputPayload: { title: "Bug" },
      legacyInputRedacted: { present: true },
      legacyOutputRedacted: null,
      outputPayload: null,
      errorCode: null,
      errorMessage: null,
      startedAt,
      finishedAt: null,
      createdAt: startedAt,
      updatedAt: startedAt,
    };
    const valuesMock = vi.fn(() => ({
      $returningId: () => Promise.resolve([{ id: 1 }]),
    }));
    const db = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn(() => selectRows([inserted])),
    } as unknown as Database;

    await expect(
      createProviderRoutineCall(db, {
        calledById: "run_123",
        calledByKind: "automation",
        calledByUserId: null,
        clerkOrgId: "org_123",
        providerConnectionId: 42,
        inputPayload: { title: "Bug" },
        provider: "linear",
        providerActorId: "actor_123",
        providerToolName: "create_issue",
        providerWorkspaceId: "workspace_123",
        routineId: "linear__create_issue",
        sourceClientId: null,
        sourceRef: "run_123",
        sourceSurface: "automation",
        startedAt,
      })
    ).resolves.toMatchObject({
      publicId: expect.stringMatching(/^provider_routine_call_[0-9a-f-]{36}$/),
      status: "running",
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        calledById: "run_123",
        calledByKind: "automation",
        clerkOrgId: "org_123",
        providerConnectionId: 42,
        inputPayload: { title: "Bug" },
        legacyInputRedacted: { present: true },
        provider: "linear",
        providerActorId: "actor_123",
        providerAttempted: false,
        providerToolName: "create_issue",
        providerWorkspaceId: "workspace_123",
        publicId: expect.stringMatching(/^provider_routine_call_/),
        routineId: "linear__create_issue",
        sourceClientId: null,
        sourceRef: "run_123",
        sourceSurface: "automation",
        status: "running",
      })
    );
  });

  it("creates chat-sourced provider routine calls", async () => {
    const inserted = {
      id: 1,
      publicId: "provider_routine_call_123e4567-e89b-12d3-a456-426614174000",
      clerkOrgId: "org_123",
      calledByKind: "user",
      calledById: "user_123",
      calledByUserId: "user_123",
      provider: "linear",
      routineId: "linear__list_issues",
      providerToolName: "list_issues",
      providerConnectionId: 42,
      providerWorkspaceId: "workspace_123",
      providerActorId: "actor_123",
      providerAttempted: false,
      sourceClientId: null,
      sourceRef: "conv_123",
      sourceSurface: "chat",
      status: "running",
      inputPayload: { query: "Bug" },
      legacyInputRedacted: { present: true },
      legacyOutputRedacted: null,
      outputPayload: null,
      errorCode: null,
      errorMessage: null,
      startedAt,
      finishedAt: null,
      createdAt: startedAt,
      updatedAt: startedAt,
    };
    const valuesMock = vi.fn(() => ({
      $returningId: () => Promise.resolve([{ id: 1 }]),
    }));
    const db = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn(() => selectRows([inserted])),
    } as unknown as Database;

    await expect(
      createProviderRoutineCall(db, {
        calledById: "user_123",
        calledByKind: "user",
        calledByUserId: "user_123",
        clerkOrgId: "org_123",
        providerConnectionId: 42,
        inputPayload: { query: "Bug" },
        provider: "linear",
        providerActorId: "actor_123",
        providerToolName: "list_issues",
        providerWorkspaceId: "workspace_123",
        routineId: "linear__list_issues",
        sourceClientId: null,
        sourceRef: "conv_123",
        sourceSurface: "chat",
        startedAt,
      })
    ).resolves.toMatchObject({
      publicId: expect.stringMatching(/^provider_routine_call_[0-9a-f-]{36}$/),
      sourceRef: "conv_123",
      sourceSurface: "chat",
      status: "running",
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        calledById: "user_123",
        calledByKind: "user",
        calledByUserId: "user_123",
        clerkOrgId: "org_123",
        sourceClientId: null,
        sourceRef: "conv_123",
        sourceSurface: "chat",
        status: "running",
      })
    );
  });

  it("marks running provider routine calls as provider attempted", async () => {
    const whereMock = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markProviderRoutineCallProviderAttempted(db, {
        clerkOrgId: "org_123",
        publicId: "provider_routine_call_123",
      })
    ).resolves.toBe(true);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerAttempted: true,
      })
    );
    const whereCondition = whereMock.mock.calls[0]?.[0];
    const columnNames = collectColumnNames(whereCondition);
    expect(columnNames).toContain("clerk_org_id");
    expect(columnNames).toContain("public_id");
    expect(columnNames).toContain("status");
  });

  it("marks running provider routine calls as succeeded", async () => {
    const whereMock = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markProviderRoutineCallSucceeded(db, {
        clerkOrgId: "org_123",
        finishedAt,
        outputPayload: { content: [{ text: "Created" }] },
        publicId: "provider_routine_call_123",
      })
    ).resolves.toBe(true);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: null,
        errorMessage: null,
        finishedAt,
        legacyOutputRedacted: { present: true },
        outputPayload: { content: [{ text: "Created" }] },
        status: "succeeded",
      })
    );
    const whereCondition = whereMock.mock.calls[0]?.[0];
    const columnNames = collectColumnNames(whereCondition);
    expect(columnNames).toContain("clerk_org_id");
    expect(columnNames).toContain("public_id");
    expect(columnNames).toContain("status");
  });

  it("marks running provider routine calls as failed with safe errors", async () => {
    const whereMock = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markProviderRoutineCallFailed(db, {
        clerkOrgId: "org_123",
        errorCode: "LINEAR_MCP_FAILED",
        errorMessage: "Linear MCP tool call failed.",
        finishedAt,
        publicId: "provider_routine_call_123",
      })
    ).resolves.toBe(true);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "LINEAR_MCP_FAILED",
        errorMessage: "Linear MCP tool call failed.",
        finishedAt,
        status: "failed",
      })
    );
    const whereCondition = whereMock.mock.calls[0]?.[0];
    const columnNames = collectColumnNames(whereCondition);
    expect(columnNames).toContain("clerk_org_id");
    expect(columnNames).toContain("public_id");
    expect(columnNames).toContain("status");
  });
});
