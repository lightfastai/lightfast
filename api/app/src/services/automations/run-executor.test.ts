import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecuteAutomationRunInput } from "./ai-execution";
import type { AutomationRunAiOutput } from "./output";

const executeAutomationRunMock = vi.fn();
const getAutomationExecutionFailureMock = vi.fn();

vi.mock("./ai-execution", () => ({
  executeAutomationRun: executeAutomationRunMock,
}));

vi.mock("./errors", () => ({
  getAutomationExecutionFailure: getAutomationExecutionFailureMock,
}));

const { executeAutomationRunRequest } = await import("./run-executor");

const input = {
  automation: {
    clerkOrgId: "org_test",
    connectorProvider: null,
    createdByUserId: "user_test",
    name: "Weekly decisions summary",
    prompt: "Summarize recent decisions.",
    publicId: "automation_123",
    scheduleConfig: { dayOfWeek: 1, time: "09:00" },
    scheduleKind: "weekly",
    timezone: "UTC",
  },
  deploymentEnvironment: "preview",
  run: {
    publicId: "automation_run_123",
    trigger: "manual",
  },
} as ExecuteAutomationRunInput;

const output: AutomationRunAiOutput = {
  automationId: "automation_123",
  connectorProvider: null,
  finalText: "Summarized recent decisions.",
  finishedAt: "2026-06-06T00:01:00.000Z",
  finishReason: "stop",
  model: "anthropic/claude-sonnet-4.6",
  providerRoutineCallIds: [],
  runId: "automation_run_123",
  schemaVersion: "automation.run.ai.v1",
  startedAt: "2026-06-06T00:00:00.000Z",
  transcript: [],
  usage: {},
};

beforeEach(() => {
  executeAutomationRunMock.mockReset();
  getAutomationExecutionFailureMock.mockReset();
});

describe("executeAutomationRunRequest", () => {
  it("returns a completed result with automation output", async () => {
    executeAutomationRunMock.mockResolvedValue(output);

    await expect(executeAutomationRunRequest(input)).resolves.toEqual({
      output,
      status: "completed",
    });
    expect(executeAutomationRunMock).toHaveBeenCalledWith(input);
    expect(getAutomationExecutionFailureMock).not.toHaveBeenCalled();
  });

  it("maps execution errors to failed run results", async () => {
    const error = new Error("model unavailable");
    const failure = {
      errorCode: "AUTOMATION_MODEL_FAILED",
      errorMessage: "Automation model execution failed.",
    };
    executeAutomationRunMock.mockRejectedValue(error);
    getAutomationExecutionFailureMock.mockReturnValue(failure);

    await expect(executeAutomationRunRequest(input)).resolves.toEqual({
      failure,
      status: "failed",
    });
    expect(getAutomationExecutionFailureMock).toHaveBeenCalledWith(error);
  });
});
