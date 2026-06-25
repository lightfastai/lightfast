import { describe, expect, it } from "vitest";
import {
  automationExecutionError,
  getAutomationExecutionFailure,
} from "../services/automations/errors";
import {
  AUTOMATION_AI_OUTPUT_SCHEMA_VERSION,
  buildAutomationRunOutput,
  createAutomationTranscriptRecorder,
} from "../services/automations/output";

describe("automation execution failures", () => {
  it("maps expected automation execution errors to stable run failures", () => {
    const failure = getAutomationExecutionFailure(
      automationExecutionError({
        code: "AUTOMATION_CONNECTOR_NOT_ENABLED",
        message: "The selected connector is not enabled for automations.",
      })
    );

    expect(failure).toEqual({
      errorCode: "AUTOMATION_CONNECTOR_NOT_ENABLED",
      errorMessage: "The selected connector is not enabled for automations.",
    });
  });

  it("maps unexpected errors to model failure without leaking raw messages", () => {
    const failure = getAutomationExecutionFailure(
      new Error("secret provider dump")
    );

    expect(failure).toEqual({
      errorCode: "AUTOMATION_MODEL_FAILED",
      errorMessage: "Automation model execution failed.",
    });
  });
});

describe("automation run output", () => {
  it("preserves model-visible text content and hashes it", () => {
    const recorder = createAutomationTranscriptRecorder();
    recorder.recordUser("Create the issue");

    expect(recorder.events()).toEqual([
      expect.objectContaining({
        content: "Create the issue",
        contentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        kind: "user",
      }),
    ]);
  });

  it("redacts tool payloads while preserving provider routine call ids", () => {
    const recorder = createAutomationTranscriptRecorder();
    recorder.recordToolCall({
      input: { title: "secret-title" },
      provider: "linear",
      providerToolName: "create_issue",
      routineId: "linear__create_issue",
      toolName: "callProviderRoutine",
    });
    recorder.recordToolResult({
      output: { content: [{ text: "secret-output" }] },
      providerRoutineCallId: "provider_routine_call_123",
      routineId: "linear__create_issue",
      status: "succeeded",
      toolName: "callProviderRoutine",
    });

    const output = buildAutomationRunOutput({
      automation: {
        connectorProvider: "linear",
        name: "Morning check",
        prompt: "Create the issue",
        publicId: "automation_123",
        targetKind: "connector",
      },
      finishedAt: new Date("2026-06-06T00:00:10.000Z"),
      model: "anthropic/claude-sonnet-4.6",
      result: {
        finishReason: "stop",
        text: "Created the Linear issue.",
        totalUsage: { inputTokens: 10, reasoningTokens: 3, totalTokens: 22 },
      },
      run: { publicId: "automation_run_123" },
      startedAt: new Date("2026-06-06T00:00:00.000Z"),
      transcriptEvents: recorder.events(),
    });

    expect(output).toMatchObject({
      automationId: "automation_123",
      connectorProvider: "linear",
      finalText: "Created the Linear issue.",
      providerRoutineCallIds: ["provider_routine_call_123"],
      runId: "automation_run_123",
      schemaVersion: AUTOMATION_AI_OUTPUT_SCHEMA_VERSION,
      targetKind: "connector",
      usage: { inputTokens: 10, reasoningTokens: 3, totalTokens: 22 },
    });
    expect(JSON.stringify(output)).not.toContain("secret-title");
    expect(JSON.stringify(output)).not.toContain("secret-output");
    expect(output.transcript).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inputRedacted: { present: true },
          kind: "tool_call",
          routineId: "linear__create_issue",
        }),
        expect.objectContaining({
          kind: "tool_result",
          outputRedacted: { present: true },
          providerRoutineCallId: "provider_routine_call_123",
        }),
      ])
    );
  });

  it("sanitizes transcript events at the output builder boundary", () => {
    const transcriptEvents = [
      {
        input: { title: "secret-title" },
        inputRedacted: { present: true, raw: "secret-redaction-input" },
        kind: "tool_call",
        provider: "linear",
        routineId: "linear__create_issue",
        timestamp: "2026-06-06T00:00:01.000Z",
        toolName: "callProviderRoutine",
      },
      {
        kind: "tool_result",
        output: { content: [{ text: "secret-output" }] },
        outputRedacted: { present: true, raw: "secret-redaction-output" },
        providerRoutineCallId: "provider_routine_call_123",
        routineId: "linear__create_issue",
        status: "succeeded",
        timestamp: "2026-06-06T00:00:02.000Z",
        toolName: "callProviderRoutine",
      },
    ] as unknown as Parameters<
      typeof buildAutomationRunOutput
    >[0]["transcriptEvents"];

    const output = buildAutomationRunOutput({
      automation: {
        connectorProvider: "linear",
        name: "Morning check",
        prompt: "Create the issue",
        publicId: "automation_123",
        targetKind: "connector",
      },
      finishedAt: new Date("2026-06-06T00:00:10.000Z"),
      model: "anthropic/claude-sonnet-4.6",
      result: {
        finishReason: "stop",
        text: "Created the Linear issue.",
      },
      run: { publicId: "automation_run_123" },
      startedAt: new Date("2026-06-06T00:00:00.000Z"),
      transcriptEvents,
    });

    expect(JSON.stringify(output)).not.toContain("secret-title");
    expect(JSON.stringify(output)).not.toContain("secret-output");
    expect(JSON.stringify(output)).not.toContain("secret-redaction-input");
    expect(JSON.stringify(output)).not.toContain("secret-redaction-output");
    expect(output.transcript).toEqual([
      {
        inputRedacted: { present: true },
        kind: "tool_call",
        provider: "linear",
        routineId: "linear__create_issue",
        timestamp: "2026-06-06T00:00:01.000Z",
        toolName: "callProviderRoutine",
      },
      {
        kind: "tool_result",
        outputRedacted: { present: true },
        providerRoutineCallId: "provider_routine_call_123",
        routineId: "linear__create_issue",
        status: "succeeded",
        timestamp: "2026-06-06T00:00:02.000Z",
        toolName: "callProviderRoutine",
      },
    ]);
  });

  it("dedupes provider routine call ids while preserving first-seen order", () => {
    const output = buildAutomationRunOutput({
      automation: {
        connectorProvider: "linear",
        name: "Morning check",
        prompt: "Create the issue",
        publicId: "automation_123",
        targetKind: "connector",
      },
      finishedAt: new Date("2026-06-06T00:00:10.000Z"),
      model: "anthropic/claude-sonnet-4.6",
      result: {
        finishReason: "stop",
        text: "Created the Linear issue.",
      },
      run: { publicId: "automation_run_123" },
      startedAt: new Date("2026-06-06T00:00:00.000Z"),
      transcriptEvents: [
        {
          kind: "tool_result",
          outputRedacted: { present: true },
          providerRoutineCallId: "provider_routine_call_b",
          status: "succeeded",
          timestamp: "2026-06-06T00:00:01.000Z",
          toolName: "callProviderRoutine",
        },
        {
          errorCode: "AUTOMATION_TOOL_FAILED",
          errorMessage: "Tool failed.",
          kind: "tool_error",
          providerRoutineCallId: "provider_routine_call_a",
          timestamp: "2026-06-06T00:00:02.000Z",
          toolName: "callProviderRoutine",
        },
        {
          kind: "tool_result",
          outputRedacted: { present: true },
          providerRoutineCallId: "provider_routine_call_b",
          status: "succeeded",
          timestamp: "2026-06-06T00:00:03.000Z",
          toolName: "callProviderRoutine",
        },
      ],
    });

    expect(output.providerRoutineCallIds).toEqual([
      "provider_routine_call_b",
      "provider_routine_call_a",
    ]);
  });

  it("falls back to result usage and ignores non-object usage", () => {
    expect(
      buildAutomationRunOutput({
        automation: {
          connectorProvider: "linear",
          name: "Morning check",
          prompt: "Create the issue",
          publicId: "automation_123",
          targetKind: "connector",
        },
        finishedAt: new Date("2026-06-06T00:00:10.000Z"),
        model: "anthropic/claude-sonnet-4.6",
        result: {
          finishReason: "stop",
          text: "Created the Linear issue.",
          usage: { cachedInputTokens: 5 },
        },
        run: { publicId: "automation_run_123" },
        startedAt: new Date("2026-06-06T00:00:00.000Z"),
        transcriptEvents: [],
      }).usage
    ).toEqual({ cachedInputTokens: 5 });

    expect(
      buildAutomationRunOutput({
        automation: {
          connectorProvider: "linear",
          name: "Morning check",
          prompt: "Create the issue",
          publicId: "automation_123",
          targetKind: "connector",
        },
        finishedAt: new Date("2026-06-06T00:00:10.000Z"),
        model: "anthropic/claude-sonnet-4.6",
        result: {
          finishReason: "stop",
          text: "Created the Linear issue.",
          totalUsage: "not usage",
        },
        run: { publicId: "automation_run_123" },
        startedAt: new Date("2026-06-06T00:00:00.000Z"),
        transcriptEvents: [],
      }).usage
    ).toEqual({});
  });

  it("uses result usage when total usage is present but invalid", () => {
    expect(
      buildAutomationRunOutput({
        automation: {
          connectorProvider: "linear",
          name: "Morning check",
          prompt: "Create the issue",
          publicId: "automation_123",
          targetKind: "connector",
        },
        finishedAt: new Date("2026-06-06T00:00:10.000Z"),
        model: "anthropic/claude-sonnet-4.6",
        result: {
          finishReason: "stop",
          text: "Created the Linear issue.",
          totalUsage: "not usage",
          usage: { totalTokens: 10 },
        },
        run: { publicId: "automation_run_123" },
        startedAt: new Date("2026-06-06T00:00:00.000Z"),
        transcriptEvents: [],
      }).usage
    ).toEqual({ totalTokens: 10 });
  });
});
