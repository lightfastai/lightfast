import { describe, expect, it, vi } from "vitest";
import type { Database } from "../client";
import {
  createUserConnectorToolCallId,
  USER_CONNECTOR_TOOL_CALL_ID_PREFIX,
  userConnectorToolCalls,
} from "../schema/tables/user-connector-tool-calls";
import {
  createUserConnectorToolCall,
  markUserConnectorToolCallFailed,
  markUserConnectorToolCallProviderAttempted,
  markUserConnectorToolCallSucceeded,
} from "../utils/user-connector-tool-calls";

const startedAt = new Date("2026-06-06T00:00:00.000Z");
const finishedAt = new Date("2026-06-06T00:01:00.000Z");

function makeToolCall(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    publicId:
      "user_connector_tool_call_123e4567-e89b-12d3-a456-426614174000",
    calledByUserId: "user_123",
    clerkOrgId: "org_123",
    provider: "granola",
    routineId: "granola__search_notes",
    providerToolName: "search_notes",
    providerConnectionId: 1,
    providerAttempted: false,
    sourceRef: "conv_123",
    sourceSurface: "interactive_chat",
    status: "running",
    inputRedacted: { present: true },
    outputRedacted: null,
    errorCode: null,
    errorMessage: null,
    startedAt,
    finishedAt: null,
    createdAt: startedAt,
    updatedAt: startedAt,
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

describe("user connector tool call helpers", () => {
  it("exports a nullable-org user connector tool call table with stable public ids", () => {
    const publicId = createUserConnectorToolCallId();

    expect(publicId.startsWith(USER_CONNECTOR_TOOL_CALL_ID_PREFIX)).toBe(true);
    expect(publicId).toMatch(
      /^user_connector_tool_call_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(publicId.length).toBeLessThanOrEqual(80);
    expect(userConnectorToolCalls.calledByUserId.notNull).toBe(true);
    expect(userConnectorToolCalls.clerkOrgId.notNull).toBe(false);
    expect(userConnectorToolCalls.sourceSurface.notNull).toBe(true);
    expect(userConnectorToolCalls.providerAttempted.notNull).toBe(true);
  });

  it("creates running user connector tool calls with a generated public id", async () => {
    const inserted = makeToolCall();
    const valuesMock = vi.fn(() => ({
      $returningId: () => Promise.resolve([{ id: 1 }]),
    }));
    const db = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn(() => selectRows([inserted])),
    } as unknown as Database;

    await expect(
      createUserConnectorToolCall(db, {
        calledByUserId: "user_123",
        clerkOrgId: "org_123",
        inputRedacted: { present: true },
        provider: "granola",
        providerConnectionId: 1,
        providerToolName: "search_notes",
        routineId: "granola__search_notes",
        sourceRef: "conv_123",
        sourceSurface: "interactive_chat",
        startedAt,
      })
    ).resolves.toMatchObject({
      publicId: expect.stringMatching(
        /^user_connector_tool_call_[0-9a-f-]{36}$/
      ),
      status: "running",
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        calledByUserId: "user_123",
        clerkOrgId: "org_123",
        inputRedacted: { present: true },
        outputRedacted: null,
        provider: "granola",
        providerAttempted: false,
        providerConnectionId: 1,
        providerToolName: "search_notes",
        publicId: expect.stringMatching(/^user_connector_tool_call_/),
        routineId: "granola__search_notes",
        sourceRef: "conv_123",
        sourceSurface: "interactive_chat",
        startedAt,
        status: "running",
      })
    );
  });

  it("marks running user connector tool calls as provider attempted", async () => {
    const whereMock = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markUserConnectorToolCallProviderAttempted(db, {
        calledByUserId: "user_123",
        publicId: "user_connector_tool_call_123",
      })
    ).resolves.toBe(true);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerAttempted: true,
      })
    );
    const whereCondition = whereMock.mock.calls[0]?.[0];
    const columnNames = collectColumnNames(whereCondition);
    expect(columnNames).toContain("called_by_user_id");
    expect(columnNames).toContain("public_id");
    expect(columnNames).toContain("status");
  });

  it("marks running user connector tool calls as succeeded", async () => {
    const whereMock = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markUserConnectorToolCallSucceeded(db, {
        calledByUserId: "user_123",
        finishedAt,
        outputRedacted: { present: true },
        publicId: "user_connector_tool_call_123",
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
    expect(columnNames).toContain("called_by_user_id");
    expect(columnNames).toContain("public_id");
    expect(columnNames).toContain("status");
  });

  it("marks running user connector tool calls as failed with safe errors", async () => {
    const whereMock = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markUserConnectorToolCallFailed(db, {
        calledByUserId: "user_123",
        errorCode: "GRANOLA_MCP_FAILED",
        errorMessage: "Granola MCP tool call failed.",
        finishedAt,
        publicId: "user_connector_tool_call_123",
      })
    ).resolves.toBe(true);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "GRANOLA_MCP_FAILED",
        errorMessage: "Granola MCP tool call failed.",
        finishedAt,
        status: "failed",
      })
    );
    const whereCondition = whereMock.mock.calls[0]?.[0];
    const columnNames = collectColumnNames(whereCondition);
    expect(columnNames).toContain("called_by_user_id");
    expect(columnNames).toContain("public_id");
    expect(columnNames).toContain("status");
  });
});
