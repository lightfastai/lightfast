import type { AppRouterOutputs } from "@api/app";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useSuspenseQueryMock = vi.fn();
const useIsMutatingMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useIsMutating: useIsMutatingMock,
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        automations: {
          get: {
            queryOptions: (input: unknown) => ({
              queryKey: ["automation", input],
            }),
          },
          update: {
            mutationKey: () => ["automation", "update"],
          },
        },
      },
    },
  }),
}));

vi.mock("./automation-actions", () => ({
  AutomationActions: () => <div data-testid="automation-actions" />,
}));
vi.mock("./automation-name-editor", () => ({
  AutomationNameEditor: () => <h1>Morning check</h1>,
}));
vi.mock("./automation-prompt-editor", () => ({
  AutomationPromptEditor: () => <div data-testid="prompt-editor" />,
}));
vi.mock("./automation-runs-section", () => ({
  AutomationRunsSection: () => <div data-testid="runs-section" />,
}));
vi.mock("./automation-schedule-editor", () => ({
  AutomationScheduleEditor: () => <div>Every day at 9:00 AM</div>,
}));
vi.mock("./automation-status-chip", () => ({
  AutomationStatusChip: () => <div>Active</div>,
}));

const { AutomationDetailClient } = await import("./automation-detail-client");

type Automation =
  AppRouterOutputs["org"]["workspace"]["automations"]["get"];

const automation = {
  connectorProvider: "x",
  lastRunAt: null,
  nextRunAt: new Date("2026-06-06T09:00:00.000Z"),
} as Automation;

describe("AutomationDetailClient", () => {
  it("shows the selected connector in the details rail", () => {
    useIsMutatingMock.mockReturnValue(0);
    useSuspenseQueryMock.mockReturnValue({ data: automation });

    render(<AutomationDetailClient automationId="automation_123" />);

    expect(screen.getByText("Connector")).toBeInTheDocument();
    expect(screen.getByText("X")).toBeInTheDocument();
  });
});
