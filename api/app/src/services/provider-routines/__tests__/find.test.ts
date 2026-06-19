import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderRoutineServiceContext } from "../context";

const listCurrentOrgConnectorConnectionsMock = vi.fn();

vi.mock("@db/app", () => ({
  listCurrentOrgConnectorConnections: listCurrentOrgConnectorConnectionsMock,
}));

const { findProviderRoutines } = await import("../find");

const now = new Date("2026-06-02T00:00:00.000Z");

function context(
  overrides: Partial<ProviderRoutineServiceContext> = {}
): ProviderRoutineServiceContext {
  return {
    actor: { orgId: "org_acme", userId: "user_123" },
    db: {} as ProviderRoutineServiceContext["db"],
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    now: () => now,
    scopes: { providerRoutineRead: true, providerRoutineWrite: false },
    source: {
      clientId: "mcp_client_123",
      ref: "grant_123",
      surface: "hosted_mcp",
    },
    ...overrides,
  };
}

function connection(overrides: Record<string, unknown> = {}) {
  return {
    clerkOrgId: "org_acme",
    enabledForAgents: true,
    id: 1,
    provider: "linear",
    status: "active",
    toolManifest: [
      {
        description: "List Linear issues",
        inputSchema: { type: "object" },
        name: "list_issues",
      },
      {
        description: "Create a Linear issue",
        inputSchema: {
          properties: { title: { type: "string" } },
          required: ["title"],
          type: "object",
        },
        name: "create_issue",
      },
      {
        description: "Future Linear tool",
        inputSchema: { type: "object" },
        name: "future_tool",
      },
    ],
    ...overrides,
  };
}

describe("findProviderRoutines", () => {
  beforeEach(() => {
    listCurrentOrgConnectorConnectionsMock.mockReset();
  });

  it("returns no_enabled_providers when no current provider is agent-enabled", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({ enabledForAgents: false }),
    ]);

    await expect(
      findProviderRoutines(context(), { query: "create_issue" })
    ).resolves.toEqual({
      reason: "no_enabled_providers",
      routines: [],
    });
  });

  it("does not reveal disabled provider routine names", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({ enabledForAgents: false }),
    ]);

    const result = await findProviderRoutines(context(), {
      query: "future_tool",
    });

    expect(JSON.stringify(result)).not.toContain("future_tool");
  });

  it("filters write and unknown routines out for read-only source scope", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);

    await expect(findProviderRoutines(context(), {})).resolves.toMatchObject({
      routines: [
        {
          classification: "read",
          provider: "linear",
          providerToolName: "list_issues",
          routineId: "linear__list_issues",
        },
      ],
    });
  });

  it("finds connector runtime adapter tools without reading connector rows", async () => {
    const loadConnectorToolsMock = vi.fn(async () => [
      {
        callWithMetadata: vi.fn(),
        description: "Create an X post",
        inputSchema: {
          properties: { text: { type: "string" } },
          required: ["text"],
          type: "object",
        },
        provider: "x" as const,
        providerToolName: "createPost",
        runtimeToolName: "x__createPost",
      },
    ]);

    await expect(
      findProviderRoutines(
        context({
          adapters: { connectors: { loadTools: loadConnectorToolsMock } },
          scopes: { providerRoutineRead: true, providerRoutineWrite: true },
        }),
        { query: "post", includeSchema: true }
      )
    ).resolves.toMatchObject({
      routines: [
        {
          classification: "write",
          inputSchema: {
            properties: { text: { type: "string" } },
            required: ["text"],
            type: "object",
          },
          provider: "x",
          providerToolName: "createPost",
          routineId: "x__createPost",
        },
      ],
    });
    expect(loadConnectorToolsMock).toHaveBeenCalledOnce();
    expect(listCurrentOrgConnectorConnectionsMock).not.toHaveBeenCalled();
  });

  it("filters connector runtime adapter writes out for read-only source scope", async () => {
    const loadConnectorToolsMock = vi.fn(async () => [
      {
        callWithMetadata: vi.fn(),
        description: "Create an X post",
        inputSchema: { type: "object" },
        provider: "x" as const,
        providerToolName: "createPost",
        runtimeToolName: "x__createPost",
      },
    ]);

    await expect(
      findProviderRoutines(
        context({
          adapters: { connectors: { loadTools: loadConnectorToolsMock } },
          scopes: { providerRoutineRead: true, providerRoutineWrite: false },
        }),
        {}
      )
    ).resolves.toEqual({ reason: "no_matching_routines", routines: [] });
    expect(loadConnectorToolsMock).toHaveBeenCalledOnce();
    expect(listCurrentOrgConnectorConnectionsMock).not.toHaveBeenCalled();
  });

  it("matches camelCase connector runtime adapter titles as separate words", async () => {
    const loadConnectorToolsMock = vi.fn(async () => [
      {
        callWithMetadata: vi.fn(),
        inputSchema: { type: "object" },
        provider: "x" as const,
        providerToolName: "createPost",
        runtimeToolName: "x__createPost",
      },
    ]);

    await expect(
      findProviderRoutines(
        context({
          adapters: { connectors: { loadTools: loadConnectorToolsMock } },
          scopes: { providerRoutineRead: true, providerRoutineWrite: true },
        }),
        { query: "create post" }
      )
    ).resolves.toMatchObject({
      routines: [
        {
          provider: "x",
          providerToolName: "createPost",
          title: "Create Post",
        },
      ],
    });
  });

  it("omits cached input schemas unless includeSchema is true", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);

    const compact = await findProviderRoutines(
      context({
        scopes: { providerRoutineRead: true, providerRoutineWrite: true },
      }),
      { query: "create", includeSchema: false }
    );
    expect(compact.routines[0]).not.toHaveProperty("inputSchema");

    const detailed = await findProviderRoutines(
      context({
        scopes: { providerRoutineRead: true, providerRoutineWrite: true },
      }),
      { query: "create", includeSchema: true }
    );
    expect(detailed.routines[0]).toMatchObject({
      inputSchema: {
        properties: { title: { type: "string" } },
        required: ["title"],
        type: "object",
      },
    });
  });

  it("returns no_matching_routines after enabled providers are filtered by query", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);

    await expect(
      findProviderRoutines(context(), { query: "does-not-exist" })
    ).resolves.toEqual({
      reason: "no_matching_routines",
      routines: [],
    });
  });
});
