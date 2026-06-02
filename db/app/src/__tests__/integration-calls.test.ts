import { describe, expect, it, vi } from "vitest";
import type { Database } from "../client";
import {
  createIntegrationCall,
  listIntegrationCalls,
  markIntegrationCallFailed,
  markIntegrationCallSucceeded,
} from "../utils/integration-calls";

const startedAt = new Date("2026-06-02T00:00:00.000Z");
const finishedAt = new Date("2026-06-02T00:01:00.000Z");

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

describe("integration call helpers", () => {
  it("lists recent integration calls for one org", async () => {
    const rows = [
      {
        id: 2,
        publicId: "integration_call_new",
        clerkOrgId: "org_123",
        calledByKind: "automation",
        calledById: "run_new",
        calledByUserId: null,
        provider: "linear",
        routineName: "linear__create_issue",
        providerToolName: "create_issue",
        connectorConnectionId: 42,
        providerWorkspaceId: "workspace_123",
        providerActorId: "actor_123",
        status: "succeeded",
        inputRedacted: { present: true },
        outputRedacted: { present: true },
        errorCode: null,
        errorMessage: null,
        startedAt,
        finishedAt,
        createdAt: finishedAt,
        updatedAt: finishedAt,
      },
    ];
    const { query, spies } = listRows(rows);
    const db = {
      select: vi.fn(() => query),
    } as unknown as Database;

    await expect(
      listIntegrationCalls(db, {
        clerkOrgId: "org_123",
        limit: 2,
      })
    ).resolves.toEqual(rows);

    expect(spies.where).toHaveBeenCalledWith(expect.anything());
    expect(spies.orderBy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything()
    );
    expect(spies.limit).toHaveBeenCalledWith(2);
  });

  it("creates running integration calls with a generated public id", async () => {
    const inserted = {
      id: 1,
      publicId: "integration_call_123e4567-e89b-12d3-a456-426614174000",
      clerkOrgId: "org_123",
      calledByKind: "automation",
      calledById: "run_123",
      calledByUserId: null,
      provider: "linear",
      routineName: "linear__create_issue",
      providerToolName: "create_issue",
      connectorConnectionId: 42,
      providerWorkspaceId: "workspace_123",
      providerActorId: "actor_123",
      status: "running",
      inputRedacted: { present: true },
      outputRedacted: null,
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
      createIntegrationCall(db, {
        calledById: "run_123",
        calledByKind: "automation",
        calledByUserId: null,
        clerkOrgId: "org_123",
        connectorConnectionId: 42,
        inputRedacted: { present: true },
        provider: "linear",
        providerActorId: "actor_123",
        providerToolName: "create_issue",
        providerWorkspaceId: "workspace_123",
        routineName: "linear__create_issue",
        startedAt,
      })
    ).resolves.toMatchObject({
      publicId: expect.stringMatching(/^integration_call_[0-9a-f-]{36}$/),
      status: "running",
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        calledById: "run_123",
        calledByKind: "automation",
        clerkOrgId: "org_123",
        connectorConnectionId: 42,
        inputRedacted: { present: true },
        provider: "linear",
        providerActorId: "actor_123",
        providerToolName: "create_issue",
        providerWorkspaceId: "workspace_123",
        publicId: expect.stringMatching(/^integration_call_/),
        routineName: "linear__create_issue",
        status: "running",
      })
    );
  });

  it("marks running integration calls as succeeded", async () => {
    const whereMock = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markIntegrationCallSucceeded(db, {
        clerkOrgId: "org_123",
        finishedAt,
        outputRedacted: { present: true },
        publicId: "integration_call_123",
      })
    ).resolves.toBe(true);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: null,
        errorMessage: null,
        finishedAt,
        outputRedacted: { present: true },
        status: "succeeded",
      })
    );
    const whereCondition = whereMock.mock.calls[0]?.[0];
    const columnNames = collectColumnNames(whereCondition);
    expect(columnNames).toContain("clerk_org_id");
    expect(columnNames).toContain("public_id");
    expect(columnNames).toContain("status");
  });

  it("marks running integration calls as failed with safe errors", async () => {
    const whereMock = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markIntegrationCallFailed(db, {
        clerkOrgId: "org_123",
        errorCode: "LINEAR_MCP_FAILED",
        errorMessage: "Linear MCP tool call failed.",
        finishedAt,
        publicId: "integration_call_123",
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
