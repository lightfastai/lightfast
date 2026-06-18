// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutomationRunDetailContent } from "~/automations/automation-run-detail-content";
import type { AutomationRunDetail } from "~/automations/automations-queries";

type AutomationRun = AutomationRunDetail;

vi.mock("@repo/ui/components/ui/badge", () => ({
  Badge: ({ children, ...props }: ComponentProps<"span">) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("AutomationRunDetailContent", () => {
  it("renders automation ai output with provider routine call ids", () => {
    render(
      <AutomationRunDetailContent
        onCopyLink={vi.fn()}
        run={run({
          output: {
            automationId: "automation_123",
            connectorProvider: "x",
            finalText: "Posted the launch update.",
            finishedAt: "2026-06-06T00:00:10.000Z",
            finishReason: "stop",
            model: "anthropic/claude-sonnet-4.6",
            providerRoutineCallIds: ["provider_routine_call_123"],
            runId: "automation_run_123",
            schemaVersion: "automation.run.ai.v1",
            startedAt: "2026-06-06T00:00:00.000Z",
            transcript: [
              {
                content: "Post a concise launch update.",
                contentHash: "sha256:abc",
                kind: "user",
                timestamp: "2026-06-06T00:00:00.000Z",
              },
              {
                inputRedacted: { present: true },
                kind: "tool_call",
                provider: "x",
                providerToolName: "postTweet",
                routineId: "x__postTweet",
                timestamp: "2026-06-06T00:00:01.000Z",
                toolName: "callProviderRoutine",
              },
              {
                kind: "tool_result",
                outputRedacted: { present: true },
                providerRoutineCallId: "provider_routine_call_123",
                routineId: "x__postTweet",
                status: "succeeded",
                timestamp: "2026-06-06T00:00:02.000Z",
                toolName: "callProviderRoutine",
              },
            ],
            usage: { totalTokens: 22 },
          },
        })}
      />
    );

    expect(screen.getByText("Posted the launch update.")).toBeTruthy();
    expect(screen.getByText("X")).toBeTruthy();
    expect(
      screen.getAllByText("provider_routine_call_123").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("x__postTweet").length).toBeGreaterThan(0);
    expect(screen.queryByText(/schemaVersion/)).toBeNull();
  });

  it("renders automation ai output without a connector", () => {
    render(
      <AutomationRunDetailContent
        onCopyLink={vi.fn()}
        run={run({
          output: {
            automationId: "automation_123",
            connectorProvider: null,
            finalText: "Summarized the workspace.",
            finishedAt: "2026-06-06T00:00:10.000Z",
            finishReason: "stop",
            model: "anthropic/claude-sonnet-4.6",
            providerRoutineCallIds: [],
            runId: "automation_run_123",
            schemaVersion: "automation.run.ai.v1",
            startedAt: "2026-06-06T00:00:00.000Z",
            transcript: [
              {
                content: "Summarize the workspace.",
                contentHash: "sha256:abc",
                contentLength: 24,
                kind: "user",
                timestamp: "2026-06-06T00:00:00.000Z",
              },
            ],
            usage: { totalTokens: 22 },
          },
        })}
      />
    );

    expect(screen.getByText("Summarized the workspace.")).toBeTruthy();
    expect(screen.getByText("Connector").parentElement?.textContent).toBe(
      "Connector-"
    );
    expect(screen.queryByText("Provider routine calls")).toBeNull();
  });

  it("keeps JSON fallback for unknown output schemas", () => {
    render(
      <AutomationRunDetailContent
        onCopyLink={vi.fn()}
        run={run({
          output: {
            message: "Legacy output",
            schemaVersion: "automation.run.scaffold.v1",
          },
        })}
      />
    );

    expect(screen.getByText(/automation.run.scaffold.v1/)).toBeTruthy();
  });

  it("keeps JSON fallback for malformed ai output", () => {
    render(
      <AutomationRunDetailContent
        onCopyLink={vi.fn()}
        run={run({
          output: {
            connectorProvider: "x",
            finalText: "Partial output",
            schemaVersion: "automation.run.ai.v1",
          },
        })}
      />
    );

    expect(screen.getByText(/automation.run.ai.v1/)).toBeTruthy();
    expect(screen.queryByText("Summary")).toBeNull();
  });
});

function run(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    automationId: 1,
    automationPublicId: "automation_123",
    clerkOrgId: "org_acme",
    createdAt: new Date("2026-06-06T00:00:00.000Z"),
    dueAt: new Date("2026-06-06T00:00:00.000Z"),
    errorCode: null,
    errorMessage: null,
    finishedAt: new Date("2026-06-06T00:00:10.000Z"),
    id: 1,
    idempotencyKey: "manual:123",
    output: null,
    publicId: "automation_run_123",
    scheduleVersion: 1,
    startedAt: new Date("2026-06-06T00:00:00.000Z"),
    status: "completed",
    trigger: "manual",
    updatedAt: new Date("2026-06-06T00:00:10.000Z"),
    ...overrides,
  } as AutomationRun;
}
