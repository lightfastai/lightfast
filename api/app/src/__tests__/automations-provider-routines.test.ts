import { providerRoutineId } from "@repo/api-contract";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadConnectorRuntimeToolsMock = vi.fn();

vi.mock("../services/connectors/runtime", () => ({
  ConnectorRuntimeToolCallError: class ConnectorRuntimeToolCallError extends Error {
    code: string | undefined;
    provider: string;
    providerRoutineCallId: string | null;
    providerToolName: string;
    routineId: string;
    runtimeToolName: string;

    constructor(input: {
      code?: string;
      message: string;
      provider: string;
      providerRoutineCallId: string | null;
      providerToolName: string;
      routineId: string;
      runtimeToolName: string;
    }) {
      super(input.message);
      this.name = "ConnectorRuntimeToolCallError";
      this.code = input.code;
      this.provider = input.provider;
      this.providerRoutineCallId = input.providerRoutineCallId;
      this.providerToolName = input.providerToolName;
      this.routineId = input.routineId;
      this.runtimeToolName = input.runtimeToolName;
    }
  },
  loadConnectorRuntimeTools: loadConnectorRuntimeToolsMock,
}));

const { callAutomationProviderRoutine, findAutomationProviderRoutines } =
  await import("../services/automations/provider-routines");
const { ConnectorRuntimeToolCallError } = await import(
  "../services/connectors/runtime"
);

const context = {
  automationPublicId: "automation_123",
  calledByUserId: "user_owner",
  clerkOrgId: "org_acme",
  runPublicId: "automation_run_123",
  selectedProvider: "x" as const,
};

function runtimeTool(overrides: Record<string, unknown> = {}) {
  return {
    call: vi.fn(),
    callWithMetadata: vi.fn().mockResolvedValue({
      provider: "x",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "getUsersByUsername",
      result: { content: [{ text: "ok" }] },
      routineId: "x__getUsersByUsername",
      runtimeToolName: "x__getUsersByUsername",
    }),
    description: "Look up X users",
    inputSchema: {
      properties: { username: { type: "string" } },
      required: ["username"],
      type: "object",
    },
    provider: "x",
    providerToolName: "getUsersByUsername",
    runtimeToolName: "x__getUsersByUsername",
    ...overrides,
  };
}

beforeEach(() => {
  loadConnectorRuntimeToolsMock.mockReset();
});

describe("automation provider routines", () => {
  it("finds only routines for the selected provider and includes schemas", async () => {
    loadConnectorRuntimeToolsMock.mockResolvedValue([
      runtimeTool(),
      runtimeTool({
        provider: "linear",
        providerToolName: "create_issue",
        runtimeToolName: "linear__create_issue",
      }),
    ]);

    await expect(
      findAutomationProviderRoutines(context, {
        includeSchema: true,
        provider: "linear",
      })
    ).resolves.toEqual({
      routines: [
        expect.objectContaining({
          classification: "read",
          inputSchema: expect.objectContaining({ type: "object" }),
          provider: "x",
          providerToolName: "getUsersByUsername",
          routineId: "x__getUsersByUsername",
          title: "Get Users By Username",
        }),
      ],
    });

    expect(loadConnectorRuntimeToolsMock).toHaveBeenCalledWith({
      automationPublicId: "automation_123",
      calledByUserId: "user_owner",
      clerkOrgId: "org_acme",
      runPublicId: "automation_run_123",
    });
  });

  it("returns no_enabled_providers when the selected connector has no runtime tools", async () => {
    loadConnectorRuntimeToolsMock.mockResolvedValue([
      runtimeTool({
        provider: "linear",
        providerToolName: "create_issue",
        runtimeToolName: "linear__create_issue",
      }),
    ]);

    await expect(findAutomationProviderRoutines(context, {})).resolves.toEqual({
      reason: "no_enabled_providers",
      routines: [],
    });
  });

  it("rejects routine ids for other providers before calling the runtime tool", async () => {
    await expect(
      callAutomationProviderRoutine(context, {
        input: { title: "wrong provider" },
        routineId: providerRoutineId("linear", "create_issue"),
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_NOT_ENABLED",
      routineId: "linear__create_issue",
    });
    expect(loadConnectorRuntimeToolsMock).not.toHaveBeenCalled();
  });

  it("rejects invalid array item types before calling the runtime tool", async () => {
    const tool = runtimeTool({
      inputSchema: {
        properties: {
          usernames: {
            items: { type: "string" },
            type: "array",
          },
        },
        required: ["usernames"],
        type: "object",
      },
    });
    loadConnectorRuntimeToolsMock.mockResolvedValue([tool]);

    await expect(
      callAutomationProviderRoutine(context, {
        input: { usernames: [123] },
        routineId: providerRoutineId("x", "getUsersByUsername"),
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_INVALID_INPUT",
      routineId: "x__getUsersByUsername",
    });
    expect(tool.callWithMetadata).not.toHaveBeenCalled();
  });

  it("rejects invalid nested property types before calling the runtime tool", async () => {
    const tool = runtimeTool({
      inputSchema: {
        properties: {
          user: {
            properties: {
              username: { type: "string" },
            },
            required: ["username"],
            type: "object",
          },
        },
        required: ["user"],
        type: "object",
      },
    });
    loadConnectorRuntimeToolsMock.mockResolvedValue([tool]);

    await expect(
      callAutomationProviderRoutine(context, {
        input: { user: { username: 123 } },
        routineId: providerRoutineId("x", "getUsersByUsername"),
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_INVALID_INPUT",
      routineId: "x__getUsersByUsername",
    });
    expect(tool.callWithMetadata).not.toHaveBeenCalled();
  });

  it("rejects numeric inputs below the schema minimum before calling the runtime tool", async () => {
    const tool = runtimeTool({
      inputSchema: {
        properties: {
          max_results: {
            maximum: 100,
            minimum: 10,
            type: "integer",
          },
        },
        required: ["max_results"],
        type: "object",
      },
    });
    loadConnectorRuntimeToolsMock.mockResolvedValue([tool]);

    await expect(
      callAutomationProviderRoutine(context, {
        input: { max_results: 5 },
        routineId: providerRoutineId("x", "getUsersByUsername"),
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_INVALID_INPUT",
      routineId: "x__getUsersByUsername",
    });
    expect(tool.callWithMetadata).not.toHaveBeenCalled();
  });

  it("rejects numeric inputs above the schema maximum before calling the runtime tool", async () => {
    const tool = runtimeTool({
      inputSchema: {
        properties: {
          max_results: {
            maximum: 100,
            minimum: 10,
            type: "integer",
          },
        },
        required: ["max_results"],
        type: "object",
      },
    });
    loadConnectorRuntimeToolsMock.mockResolvedValue([tool]);

    await expect(
      callAutomationProviderRoutine(context, {
        input: { max_results: 101 },
        routineId: providerRoutineId("x", "getUsersByUsername"),
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_INVALID_INPUT",
      routineId: "x__getUsersByUsername",
    });
    expect(tool.callWithMetadata).not.toHaveBeenCalled();
  });

  it("calls selected-provider routines and returns provider call ids", async () => {
    const tool = runtimeTool();
    loadConnectorRuntimeToolsMock.mockResolvedValue([tool]);

    await expect(
      callAutomationProviderRoutine(context, {
        input: { username: "lightfast" },
        routineId: providerRoutineId("x", "getUsersByUsername"),
      })
    ).resolves.toEqual({
      provider: "x",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "getUsersByUsername",
      result: { content: [{ text: "ok" }] },
      routineId: "x__getUsersByUsername",
      status: "succeeded",
    });

    expect(tool.callWithMetadata).toHaveBeenCalledWith({
      username: "lightfast",
    });
  });

  it("discovers and calls write routines under automation write scope", async () => {
    const tool = runtimeTool({
      callWithMetadata: vi.fn().mockResolvedValue({
        provider: "x",
        providerRoutineCallId: "provider_routine_call_789",
        providerToolName: "createPost",
        result: { content: [{ text: "posted" }] },
        routineId: "x__createPost",
        runtimeToolName: "x__createPost",
      }),
      description: "Publish a post on X",
      inputSchema: {
        properties: { text: { type: "string" } },
        required: ["text"],
        type: "object",
      },
      providerToolName: "createPost",
      runtimeToolName: "x__createPost",
    });
    loadConnectorRuntimeToolsMock.mockResolvedValue([tool]);

    await expect(findAutomationProviderRoutines(context, {})).resolves.toEqual({
      routines: [
        expect.objectContaining({
          classification: "write",
          provider: "x",
          providerToolName: "createPost",
          routineId: "x__createPost",
          title: "Create Post",
        }),
      ],
    });

    await expect(
      callAutomationProviderRoutine(context, {
        input: { text: "ship it" },
        routineId: providerRoutineId("x", "createPost"),
      })
    ).resolves.toEqual({
      provider: "x",
      providerRoutineCallId: "provider_routine_call_789",
      providerToolName: "createPost",
      result: { content: [{ text: "posted" }] },
      routineId: "x__createPost",
      status: "succeeded",
    });
  });

  it("does not treat null provider call ids as successful calls", async () => {
    const tool = runtimeTool({
      callWithMetadata: vi.fn().mockResolvedValue({
        provider: "x",
        providerRoutineCallId: null,
        providerToolName: "getUsersByUsername",
        result: { content: [{ text: "ok" }] },
        routineId: "x__getUsersByUsername",
        runtimeToolName: "x__getUsersByUsername",
      }),
    });
    loadConnectorRuntimeToolsMock.mockResolvedValue([tool]);

    await expect(
      callAutomationProviderRoutine(context, {
        input: { username: "lightfast" },
        routineId: providerRoutineId("x", "getUsersByUsername"),
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_PROVIDER_FAILED",
      routineId: "x__getUsersByUsername",
    });
  });

  it("throws runtime errors without ledger ids instead of converting them", async () => {
    const runtimeError = new ConnectorRuntimeToolCallError({
      cause: undefined,
      code: "X_MCP_FAILED",
      message: "X MCP tool call failed.",
      provider: "x",
      providerRoutineCallId: null,
      providerToolName: "createPost",
      routineId: "x__createPost",
      runtimeToolName: "x__createPost",
    });
    const tool = runtimeTool({
      callWithMetadata: vi.fn().mockRejectedValue(runtimeError),
      inputSchema: {
        properties: { text: { type: "string" } },
        required: ["text"],
        type: "object",
      },
      providerToolName: "createPost",
      runtimeToolName: "x__createPost",
    });
    loadConnectorRuntimeToolsMock.mockResolvedValue([tool]);

    await expect(
      callAutomationProviderRoutine(context, {
        input: { text: "ship it" },
        routineId: providerRoutineId("x", "createPost"),
      })
    ).rejects.toBe(runtimeError);
  });

  it("returns safe failed tool results when the runtime error has a ledger id", async () => {
    const tool = runtimeTool({
      callWithMetadata: vi.fn().mockRejectedValue(
        new ConnectorRuntimeToolCallError({
          cause: undefined,
          code: "X_MCP_FAILED",
          message: "X MCP tool call failed.",
          provider: "x",
          providerRoutineCallId: "provider_routine_call_456",
          providerToolName: "createPost",
          routineId: "x__createPost",
          runtimeToolName: "x__createPost",
        })
      ),
      inputSchema: {
        properties: { text: { type: "string" } },
        required: ["text"],
        type: "object",
      },
      providerToolName: "createPost",
      runtimeToolName: "x__createPost",
    });
    loadConnectorRuntimeToolsMock.mockResolvedValue([tool]);

    await expect(
      callAutomationProviderRoutine(context, {
        input: { text: "ship it" },
        routineId: providerRoutineId("x", "createPost"),
      })
    ).resolves.toEqual({
      error: {
        code: "PROVIDER_ROUTINE_PROVIDER_FAILED",
        message: "Provider routine failed.",
      },
      providerRoutineCallId: "provider_routine_call_456",
      routineId: "x__createPost",
      status: "failed",
    });
  });
});
