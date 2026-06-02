import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn((input: unknown) => ({
  input,
  queryKey: ["org", "workspace", "decisions", "list", input],
}));
const useSuspenseQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        decisions: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("@vendor/lib/time", () => ({
  formatRelativeTimeToNow: () => "just now",
}));

const { DecisionsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-client"
);

const baseDecision = {
  id: 1,
  publicId: "integration_call_123",
  clerkOrgId: "org_acme",
  calledByKind: "automation",
  calledById: "run_123",
  calledByUserId: null,
  provider: "linear",
  routineName: "linear__create_issue",
  providerToolName: "create_issue",
  connectorConnectionId: 42,
  providerWorkspaceId: "linear_workspace_lightfast_emulated",
  providerActorId: "linear_actor_lightfast_local",
  status: "succeeded",
  inputRedacted: { present: true },
  outputRedacted: { present: true },
  errorCode: null,
  errorMessage: null,
  startedAt: new Date("2026-06-02T03:20:11.419Z"),
  finishedAt: new Date("2026-06-02T03:20:11.966Z"),
  createdAt: new Date("2026-06-02T03:20:11.419Z"),
  updatedAt: new Date("2026-06-02T03:20:11.966Z"),
};

beforeEach(() => {
  listQueryOptionsMock.mockClear();
  useSuspenseQueryMock.mockReset();
});

describe("DecisionsClient", () => {
  it("renders an empty state when no decisions have been recorded", () => {
    useSuspenseQueryMock.mockReturnValue({ data: [] });

    render(<DecisionsClient />);

    expect(listQueryOptionsMock).toHaveBeenCalledWith({ limit: 50 });
    expect(screen.getByRole("heading", { name: "Decisions" })).toBeVisible();
    expect(
      screen.getByText("No decisions have been recorded yet.")
    ).toBeVisible();
  });

  it("renders succeeded and failed decisions without raw error messages", () => {
    useSuspenseQueryMock.mockReturnValue({
      data: [
        baseDecision,
        {
          ...baseDecision,
          id: 2,
          publicId: "integration_call_failed",
          calledById: "run_failed",
          status: "failed",
          outputRedacted: null,
          errorCode: "LINEAR_MCP_FAILED",
          errorMessage: "raw provider error should stay hidden",
          finishedAt: new Date("2026-06-02T03:20:12.419Z"),
        },
      ],
    });

    render(<DecisionsClient />);

    expect(screen.getAllByText("Linear")).toHaveLength(2);
    expect(screen.getAllByText("create_issue")).toHaveLength(2);
    expect(screen.getByText("Succeeded")).toBeVisible();
    expect(screen.getByText("Failed")).toBeVisible();
    expect(screen.getByText("Automation run_123")).toBeVisible();
    expect(screen.getByText("Automation run_failed")).toBeVisible();
    expect(screen.getAllByText("Input captured")).toHaveLength(2);
    expect(screen.getByText("Output captured")).toBeVisible();
    expect(screen.getByText("547 ms")).toBeVisible();
    expect(screen.getByText("1s")).toBeVisible();
    expect(screen.getByText("LINEAR_MCP_FAILED")).toBeVisible();
    expect(
      screen.queryByText("raw provider error should stay hidden")
    ).not.toBeInTheDocument();
  });

  it("opens a detail panel for a decision without exposing raw provider errors", () => {
    useSuspenseQueryMock.mockReturnValue({
      data: [
        {
          ...baseDecision,
          status: "failed",
          outputRedacted: null,
          errorCode: "LINEAR_MCP_FAILED",
          errorMessage: "raw provider error should stay hidden",
          finishedAt: new Date("2026-06-02T03:20:12.419Z"),
        },
      ],
    });

    render(<DecisionsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: /view create_issue decision/i })
    );

    const detail = screen.getByRole("dialog", { name: "Decision details" });
    expect(within(detail).getByText("integration_call_123")).toBeVisible();
    expect(within(detail).getByText("linear__create_issue")).toBeVisible();
    expect(within(detail).getByText("Automation run_123")).toBeVisible();
    expect(within(detail).getByText("LINEAR_MCP_FAILED")).toBeVisible();
    expect(within(detail).getByText("Input captured")).toBeVisible();
    expect(within(detail).queryByText("Output captured")).toBeNull();
    expect(
      within(detail).queryByText("raw provider error should stay hidden")
    ).toBeNull();
  });

  it("closes the detail panel with Escape", () => {
    useSuspenseQueryMock.mockReturnValue({ data: [baseDecision] });

    render(<DecisionsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: /view create_issue decision/i })
    );
    expect(
      screen.getByRole("dialog", { name: "Decision details" })
    ).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "Decision details" })
    ).toBeNull();
  });
});
