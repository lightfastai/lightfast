import type { Automation, AutomationRun } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const callAutomationProviderRoutineMock = vi.fn();
const findAutomationDecisionsMock = vi.fn();
const findAutomationProviderRoutinesMock = vi.fn();
const gatewayMock = vi.fn();
const generateTextMock = vi.fn();
const getAutomationDecisionMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();
const stepCountIsMock = vi.fn();
const toolMock = vi.fn((definition) => definition);

vi.mock("@vendor/ai", () => ({
  gateway: gatewayMock,
  generateText: generateTextMock,
  stepCountIs: stepCountIsMock,
  tool: toolMock,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    info: logInfoMock,
    warn: logWarnMock,
  },
}));

vi.mock("../services/automations/provider-routines", () => ({
  callAutomationProviderRoutine: callAutomationProviderRoutineMock,
  findAutomationProviderRoutines: findAutomationProviderRoutinesMock,
}));

vi.mock("../services/automations/decisions", () => ({
  findAutomationDecisions: findAutomationDecisionsMock,
  getAutomationDecision: getAutomationDecisionMock,
}));

const {
  AUTOMATION_RUN_FALLBACK_MODELS,
  AUTOMATION_RUN_MAX_TOOL_STEPS,
  AUTOMATION_RUN_MODEL,
  executeAutomationRun,
} = await import("../services/automations/ai-execution");
const { AutomationExecutionError } = await import(
  "../services/automations/errors"
);

const automation = {
  clerkOrgId: "org_acme",
  connectorProvider: "x",
  createdByUserId: "user_owner",
  name: "Post launch update",
  prompt: "Post a concise launch update.",
  publicId: "automation_123",
  scheduleConfig: { time: "09:00" },
  scheduleKind: "daily",
  targetKind: "connector",
  timezone: "UTC",
} as Automation;

const run = {
  publicId: "automation_run_123",
  trigger: "manual",
} as AutomationRun;

const providerRoutineContext = {
  automationPublicId: "automation_123",
  calledByUserId: "user_owner",
  clerkOrgId: "org_acme",
  runPublicId: "automation_run_123",
  selectedProvider: "x",
};

const decisionContext = {
  automationPublicId: "automation_123",
  clerkOrgId: "org_acme",
  runPublicId: "automation_run_123",
};

const startedAt = new Date("2026-06-06T00:00:00.000Z");
const finishedAt = new Date("2026-06-06T00:01:00.000Z");
const decisionSummary = {
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
} as const;

const decisionDetail = {
  ...decisionSummary,
  inputRedacted: { present: true },
  outputRedacted: { present: true },
  providerActorId: "actor_123",
  providerAttempted: true,
  providerConnectionId: 42,
  providerRoutineCallId: "provider_routine_call_123",
  providerWorkspaceId: "workspace_123",
  sourceClientId: null,
  sourceRef: "automation_run_123",
  updatedAt: finishedAt,
} as const;

beforeEach(() => {
  callAutomationProviderRoutineMock.mockReset();
  findAutomationDecisionsMock.mockReset();
  findAutomationDecisionsMock.mockResolvedValue({
    items: [decisionSummary],
    nextCursor: null,
  });
  findAutomationProviderRoutinesMock.mockReset();
  findAutomationProviderRoutinesMock.mockResolvedValue({
    routines: [
      {
        classification: "write",
        provider: "x",
        providerToolName: "postTweet",
        routineId: "x__postTweet",
        title: "Post Tweet",
      },
    ],
  });

  gatewayMock.mockReset();
  gatewayMock.mockReturnValue("gateway:anthropic/claude-sonnet-4.6");

  generateTextMock.mockReset();
  generateTextMock.mockResolvedValue({
    finishReason: "stop",
    text: "Posted the launch update.",
    totalUsage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
  });

  getAutomationDecisionMock.mockReset();
  getAutomationDecisionMock.mockResolvedValue(decisionDetail);

  logInfoMock.mockReset();
  logWarnMock.mockReset();

  stepCountIsMock.mockReset();
  stepCountIsMock.mockReturnValue({ stepCount: 5 });

  toolMock.mockClear();
});

describe("executeAutomationRun", () => {
  it("runs decision-target tools when no connector is selected", async () => {
    const automationWithoutConnector = {
      ...automation,
      connectorProvider: null,
      name: "Daily summary",
      prompt: "Summarize the workspace.",
      targetKind: "decisions",
    } as Automation;

    const output = await executeAutomationRun({
      automation: automationWithoutConnector,
      deploymentEnvironment: "preview",
      now: () => new Date("2026-06-06T00:00:00.000Z"),
      run,
    });

    expect(output).toMatchObject({
      automationId: "automation_123",
      connectorProvider: null,
      finalText: "Posted the launch update.",
      providerRoutineCallIds: [],
      runId: "automation_run_123",
      targetKind: "decisions",
    });
    expect(findAutomationProviderRoutinesMock).not.toHaveBeenCalled();
    expect(toolMock).toHaveBeenCalledTimes(2);
    expect(stepCountIsMock).toHaveBeenCalledWith(5);
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.objectContaining({
          findDecisions: expect.any(Object),
          getDecision: expect.any(Object),
        }),
      })
    );
    expect(generateTextMock.mock.calls[0]?.[0].system).toEqual(
      expect.stringContaining("Selected target: Decisions")
    );
    expect(generateTextMock.mock.calls[0]?.[0].system).not.toEqual(
      expect.stringContaining("Use only routines from the selected connector.")
    );
    expect(
      generateTextMock.mock.calls[0]?.[0].providerOptions.gateway.tags
    ).toEqual(expect.arrayContaining(["target:decisions", "connector:none"]));
  });

  it("preflights the selected connector routines and runs the model with automation-scoped tools", async () => {
    const output = await executeAutomationRun({
      automation,
      deploymentEnvironment: "preview",
      now: () => new Date("2026-06-06T00:00:00.000Z"),
      run,
    });

    expect(AUTOMATION_RUN_MODEL).toBe("anthropic/claude-sonnet-4.6");
    expect(AUTOMATION_RUN_FALLBACK_MODELS).toEqual(["openai/gpt-5.4"]);
    expect(AUTOMATION_RUN_MAX_TOOL_STEPS).toBe(5);
    expect(output).toMatchObject({
      automationId: "automation_123",
      connectorProvider: "x",
      finalText: "Posted the launch update.",
      finishReason: "stop",
      model: "anthropic/claude-sonnet-4.6",
      providerRoutineCallIds: [],
      runId: "automation_run_123",
      schemaVersion: "automation.run.ai.v1",
      targetKind: "connector",
      usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
    });
    expect(output.transcript).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining("scheduled Lightfast automation"),
          kind: "system",
        }),
        expect.objectContaining({
          content: "Post a concise launch update.",
          kind: "user",
        }),
        expect.objectContaining({
          content: "Posted the launch update.",
          kind: "assistant",
        }),
      ])
    );

    expect(findAutomationProviderRoutinesMock).toHaveBeenCalledWith(
      providerRoutineContext,
      { includeSchema: true, limit: 1 }
    );
    expect(gatewayMock).toHaveBeenCalledWith("anthropic/claude-sonnet-4.6");
    expect(stepCountIsMock).toHaveBeenCalledWith(5);
    expect(toolMock).toHaveBeenCalledTimes(2);
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        experimental_telemetry: expect.objectContaining({
          functionId: "automation.run",
          isEnabled: true,
          metadata: {
            automationId: "automation_123",
            clerkOrgId: "org_acme",
            connectorProvider: "x",
            environment: "preview",
            model: "anthropic/claude-sonnet-4.6",
            runId: "automation_run_123",
            target: "connector",
          },
          recordInputs: false,
          recordOutputs: false,
        }),
        model: "gateway:anthropic/claude-sonnet-4.6",
        prompt: expect.stringContaining("Post a concise launch update."),
        providerOptions: {
          gateway: expect.objectContaining({
            cacheControl: "max-age=0",
            models: ["openai/gpt-5.4"],
            tags: expect.arrayContaining([
              "feature:automation-run",
              "org:org_acme",
              "automation:automation_123",
              "run:automation_run_123",
              "target:connector",
              "connector:x",
              "env:preview",
            ]),
            user: "user_owner",
          }),
        },
        stopWhen: { stepCount: 5 },
        system: expect.stringContaining("scheduled Lightfast automation"),
        tools: expect.objectContaining({
          callProviderRoutine: expect.any(Object),
          findProviderRoutines: expect.any(Object),
        }),
      })
    );
    expect(generateTextMock.mock.calls[0]?.[0].system).toEqual(
      expect.stringContaining("Automation: Post launch update")
    );
    expect(generateTextMock.mock.calls[0]?.[0].system).toEqual(
      expect.stringContaining("Run ID: automation_run_123")
    );
    expect(generateTextMock.mock.calls[0]?.[0].system).toEqual(
      expect.stringContaining("Selected connector: x")
    );
    expect(generateTextMock.mock.calls[0]?.[0].prompt).toEqual(
      expect.stringContaining("- Trigger: manual")
    );
    expect(generateTextMock.mock.calls[0]?.[0].prompt).toEqual(
      expect.stringContaining("- Schedule kind: daily")
    );
    expect(generateTextMock.mock.calls[0]?.[0].prompt).toEqual(
      expect.stringContaining('- Schedule config: {"time":"09:00"}')
    );
    expect(generateTextMock.mock.calls[0]?.[0].prompt).toEqual(
      expect.stringContaining("- Timezone: UTC")
    );
    expect(generateTextMock.mock.calls[0]?.[0].prompt).toEqual(
      expect.stringContaining("- Current time: 2026-06-06T00:00:00.000Z")
    );
    expect(logInfoMock).toHaveBeenCalledWith(
      "[automations] run ai execution completed",
      expect.objectContaining({
        automationId: "automation_123",
        connectorProvider: "x",
        runId: "automation_run_123",
      })
    );
  });

  it("preserves non-enumerable model result fields in the persisted output", async () => {
    const result = {
      text: "Posted the launch update.",
      totalUsage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
    };
    Object.defineProperty(result, "finishReason", {
      enumerable: false,
      value: "stop",
    });
    generateTextMock.mockResolvedValue(result);

    const output = await executeAutomationRun({
      automation,
      deploymentEnvironment: "preview",
      now: () => new Date("2026-06-06T00:00:00.000Z"),
      run,
    });

    expect(output.finishReason).toBe("stop");
    expect(output.usage).toEqual({
      inputTokens: 10,
      outputTokens: 12,
      totalTokens: 22,
    });
  });

  it("fails with connector-not-enabled when no selected-provider runtime tools exist", async () => {
    findAutomationProviderRoutinesMock.mockResolvedValue({
      reason: "no_enabled_providers",
      routines: [],
    });

    await expect(
      executeAutomationRun({
        automation,
        deploymentEnvironment: "development",
        now: () => new Date("2026-06-06T00:00:00.000Z"),
        run,
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_CONNECTOR_NOT_ENABLED",
      message: "The selected connector is not enabled for automations.",
    });
  });

  it("fails connector-target runs when the connector provider is missing", async () => {
    await expect(
      executeAutomationRun({
        automation: {
          ...automation,
          connectorProvider: null,
          targetKind: "connector",
        },
        deploymentEnvironment: "development",
        now: () => new Date("2026-06-06T00:00:00.000Z"),
        run,
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_CONNECTOR_REQUIRED",
      message: "Connector automations require a connector provider.",
    });

    expect(findAutomationProviderRoutinesMock).not.toHaveBeenCalled();
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("fails with connector-no-tools when the selected connector has no matching routines", async () => {
    findAutomationProviderRoutinesMock.mockResolvedValue({
      reason: "no_matching_routines",
      routines: [],
    });

    await expect(
      executeAutomationRun({
        automation,
        deploymentEnvironment: "development",
        now: () => new Date("2026-06-06T00:00:00.000Z"),
        run,
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_CONNECTOR_NO_TOOLS",
      message: "The selected connector has no automation routines available.",
    });
  });

  it("fails with empty-output when the model returns no final text", async () => {
    generateTextMock.mockResolvedValue({
      finishReason: "stop",
      text: "  ",
      totalUsage: {},
    });

    await expect(
      executeAutomationRun({
        automation,
        deploymentEnvironment: "development",
        now: () => new Date("2026-06-06T00:00:00.000Z"),
        run,
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_EMPTY_OUTPUT",
      message: "Automation completed without a final model response.",
    });
  });

  it("maps model failures to automation model failures", async () => {
    generateTextMock.mockRejectedValue(new Error("raw gateway details"));

    let error: unknown;
    try {
      await executeAutomationRun({
        automation,
        deploymentEnvironment: "development",
        now: () => new Date("2026-06-06T00:00:00.000Z"),
        run,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AutomationExecutionError);
    expect(error).toMatchObject({
      code: "AUTOMATION_MODEL_FAILED",
      message: "Automation model execution failed.",
    });
    expect(logWarnMock).toHaveBeenCalledWith(
      "[automations] run ai execution failed",
      expect.objectContaining({
        automationId: "automation_123",
        errorCode: "AUTOMATION_MODEL_FAILED",
        runId: "automation_run_123",
      })
    );
  });

  it("fails the automation when the model runner swallows a call tool error", async () => {
    callAutomationProviderRoutineMock.mockRejectedValue(
      new Error("provider exploded")
    );
    generateTextMock.mockImplementation(async (options) => {
      try {
        await options.tools.callProviderRoutine.execute({
          input: { text: "secret-launch-text" },
          routineId: "x__postTweet",
        });
      } catch {
        // The real AI SDK can convert tool execute errors into model-visible
        // tool-error results and still resolve generateText.
      }
      return {
        finishReason: "stop",
        text: "Continued after the tool failed.",
        usage: { totalTokens: 30 },
      };
    });

    await expect(
      executeAutomationRun({
        automation,
        deploymentEnvironment: "preview",
        now: () => new Date("2026-06-06T00:00:00.000Z"),
        run,
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_TOOL_FAILED",
      message: "Provider routine failed.",
    });
  });

  it("fails the automation when the model runner swallows a find tool error", async () => {
    findAutomationProviderRoutinesMock
      .mockResolvedValueOnce({
        routines: [
          {
            classification: "write",
            provider: "x",
            providerToolName: "postTweet",
            routineId: "x__postTweet",
            title: "Post Tweet",
          },
        ],
      })
      .mockRejectedValueOnce(new Error("routine discovery failed"));
    generateTextMock.mockImplementation(async (options) => {
      try {
        await options.tools.findProviderRoutines.execute({
          query: "launch",
        });
      } catch {
        // Mirrors AI SDK tool-error conversion while preserving the failure
        // signal in the execution service.
      }
      return {
        finishReason: "stop",
        text: "Continued after routine discovery failed.",
        usage: { totalTokens: 30 },
      };
    });

    await expect(
      executeAutomationRun({
        automation,
        deploymentEnvironment: "preview",
        now: () => new Date("2026-06-06T00:00:00.000Z"),
        run,
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_TOOL_FAILED",
      message: "Provider routine failed.",
    });
  });

  it("fails the automation when the model runner swallows malformed call tool args", async () => {
    generateTextMock.mockImplementation(async (options) => {
      try {
        await options.tools.callProviderRoutine.execute({
          input: { text: "secret-launch-text" },
        });
      } catch {
        // The tool schema rejected the malformed args, but the SDK may still
        // continue with a model-visible tool-error result.
      }
      return {
        finishReason: "stop",
        text: "Continued after malformed tool args.",
        usage: { totalTokens: 30 },
      };
    });

    await expect(
      executeAutomationRun({
        automation,
        deploymentEnvironment: "preview",
        now: () => new Date("2026-06-06T00:00:00.000Z"),
        run,
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_TOOL_FAILED",
      message: "Provider routine failed.",
    });

    expect(callAutomationProviderRoutineMock).not.toHaveBeenCalled();
  });

  it("fails the automation when the model runner swallows malformed find tool args", async () => {
    generateTextMock.mockImplementation(async (options) => {
      try {
        await options.tools.findProviderRoutines.execute({
          limit: 0,
        });
      } catch {
        // The tool schema rejected the malformed args, but the SDK may still
        // continue with a model-visible tool-error result.
      }
      return {
        finishReason: "stop",
        text: "Continued after malformed find args.",
        usage: { totalTokens: 30 },
      };
    });

    await expect(
      executeAutomationRun({
        automation,
        deploymentEnvironment: "preview",
        now: () => new Date("2026-06-06T00:00:00.000Z"),
        run,
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_TOOL_FAILED",
      message: "Provider routine failed.",
    });
  });

  it("delegates generated tools with selected-provider context and records redacted tool transcript", async () => {
    findAutomationProviderRoutinesMock
      .mockResolvedValueOnce({
        routines: [
          {
            classification: "write",
            provider: "x",
            providerToolName: "postTweet",
            routineId: "x__postTweet",
            title: "Post Tweet",
          },
        ],
      })
      .mockResolvedValueOnce({
        routines: [
          {
            classification: "write",
            provider: "x",
            providerToolName: "postTweet",
            routineId: "x__postTweet",
            title: "Post Tweet",
          },
        ],
      });
    callAutomationProviderRoutineMock.mockResolvedValue({
      provider: "x",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "postTweet",
      result: { content: [{ text: "secret-provider-output" }] },
      routineId: "x__postTweet",
      status: "succeeded",
    });
    generateTextMock.mockImplementation(async (options) => {
      await options.tools.findProviderRoutines.execute({
        provider: "linear",
        query: "launch",
      });
      await options.tools.callProviderRoutine.execute({
        input: { text: "secret-launch-text" },
        routineId: "x__postTweet",
      });
      return {
        finishReason: "stop",
        text: "Posted through X.",
        usage: { totalTokens: 30 },
      };
    });

    const output = await executeAutomationRun({
      automation,
      deploymentEnvironment: "preview",
      now: () => new Date("2026-06-06T00:00:00.000Z"),
      run,
    });

    expect(findAutomationProviderRoutinesMock).toHaveBeenNthCalledWith(
      1,
      providerRoutineContext,
      { includeSchema: true, limit: 1 }
    );
    expect(findAutomationProviderRoutinesMock).toHaveBeenNthCalledWith(
      2,
      providerRoutineContext,
      { includeSchema: true, provider: "x", query: "launch" }
    );
    expect(callAutomationProviderRoutineMock).toHaveBeenCalledWith(
      providerRoutineContext,
      {
        input: { text: "secret-launch-text" },
        routineId: "x__postTweet",
      }
    );
    expect(output).toMatchObject({
      finalText: "Posted through X.",
      providerRoutineCallIds: ["provider_routine_call_123"],
      usage: { totalTokens: 30 },
    });
    expect(JSON.stringify(output)).not.toContain("secret-launch-text");
    expect(JSON.stringify(output)).not.toContain("secret-provider-output");
    expect(output.transcript).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inputRedacted: { present: true },
          kind: "tool_call",
          toolName: "findProviderRoutines",
        }),
        expect.objectContaining({
          kind: "tool_result",
          outputRedacted: null,
          routineCount: 1,
          status: "succeeded",
          toolName: "findProviderRoutines",
        }),
        expect.objectContaining({
          inputRedacted: { present: true },
          kind: "tool_call",
          routineId: "x__postTweet",
          toolName: "callProviderRoutine",
        }),
        expect.objectContaining({
          kind: "tool_result",
          outputRedacted: { present: true },
          providerRoutineCallId: "provider_routine_call_123",
          routineId: "x__postTweet",
          status: "succeeded",
          toolName: "callProviderRoutine",
        }),
      ])
    );
  });

  it("delegates decision-target tools and records redacted decision transcript", async () => {
    const automationWithoutConnector = {
      ...automation,
      connectorProvider: null,
      name: "Weekly Linear decisions",
      prompt: "Summarize Linear issue decisions from the past week.",
      targetKind: "decisions",
    } as Automation;
    generateTextMock.mockImplementation(async (options) => {
      await options.tools.findDecisions.execute({
        providers: ["linear"],
        query: "linear create issue",
        since: "2026-05-30T00:00:00.000Z",
      });
      await options.tools.getDecision.execute({
        id: "provider_routine_call_123",
      });
      return {
        finishReason: "stop",
        text: "Found one Linear create issue decision.",
        usage: { totalTokens: 30 },
      };
    });

    const output = await executeAutomationRun({
      automation: automationWithoutConnector,
      deploymentEnvironment: "preview",
      now: () => new Date("2026-06-06T00:00:00.000Z"),
      run,
    });

    expect(findAutomationProviderRoutinesMock).not.toHaveBeenCalled();
    expect(findAutomationDecisionsMock).toHaveBeenCalledWith(decisionContext, {
      providers: ["linear"],
      query: "linear create issue",
      since: new Date("2026-05-30T00:00:00.000Z"),
    });
    expect(getAutomationDecisionMock).toHaveBeenCalledWith(decisionContext, {
      id: "provider_routine_call_123",
    });
    expect(output).toMatchObject({
      connectorProvider: null,
      finalText: "Found one Linear create issue decision.",
      providerRoutineCallIds: [],
      targetKind: "decisions",
      usage: { totalTokens: 30 },
    });
    expect(JSON.stringify(output)).not.toContain("secret");
    expect(output.transcript).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inputRedacted: { present: true },
          kind: "tool_call",
          toolName: "findDecisions",
        }),
        expect.objectContaining({
          decisionCount: 1,
          kind: "tool_result",
          outputRedacted: null,
          status: "succeeded",
          toolName: "findDecisions",
        }),
        expect.objectContaining({
          decisionId: "provider_routine_call_123",
          inputRedacted: { present: true },
          kind: "tool_call",
          toolName: "getDecision",
        }),
        expect.objectContaining({
          decisionId: "provider_routine_call_123",
          kind: "tool_result",
          outputRedacted: { present: true },
          status: "succeeded",
          toolName: "getDecision",
        }),
      ])
    );
  });
});
