// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutomationDetailClient } from "~/automations/automation-detail-client";
import type { Automation } from "~/automations/automations-cache";

const { useIsMutatingMock, useQueryMock } = vi.hoisted(() => ({
  useIsMutatingMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useIsMutating: useIsMutatingMock,
  useQuery: useQueryMock,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: ComponentProps<"a">) => (
    <a href="/acme/automations">{children}</a>
  ),
}));

vi.mock("~/automations/automations-queries", () => ({
  automationDetailQueryOptions: (input: unknown) => ({
    queryKey: ["automation", input],
  }),
  automationMutationKeys: {
    update: () => ["automation", "update"],
  },
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@repo/ui-v2/components/ui/sidebar", () => ({
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button aria-label="Toggle Sidebar" className={className} type="button" />
  ),
}));

vi.mock("~/automations/automation-actions", () => ({
  AutomationActions: () => <div data-testid="automation-actions" />,
}));

vi.mock("~/automations/automation-name-editor", () => ({
  AutomationNameEditor: () => <h1>Morning check</h1>,
}));

vi.mock("~/automations/automation-prompt-editor", () => ({
  AutomationPromptEditor: () => <div data-testid="prompt-editor" />,
}));

vi.mock("~/automations/automation-runs-section", () => ({
  AutomationRunsSection: () => <div data-testid="runs-section" />,
}));

vi.mock("~/automations/automation-schedule-editor", () => ({
  AutomationScheduleEditor: () => <div>Every day at 9:00 AM</div>,
}));

vi.mock("~/automations/automation-status-chip", () => ({
  AutomationStatusChip: () => <div>Active</div>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AutomationDetailClient", () => {
  it("shows the selected connector in the details rail", () => {
    useIsMutatingMock.mockReturnValue(0);
    useQueryMock.mockReturnValue({
      data: automation({ connectorProvider: "x" }),
      isError: false,
      isPending: false,
    });

    render(
      <AutomationDetailClient
        automationId="automation_123"
        selectedRunId={null}
        setSelectedRunId={vi.fn()}
        slug="acme"
      />
    );

    const connectorLabel = screen.getByText("Connector");
    const connectorRow = connectorLabel.parentElement;

    expect(connectorRow?.textContent).toContain("Connector");
    expect(connectorRow?.textContent).toContain("X");
  });
});

function automation(overrides: Partial<Automation> = {}): Automation {
  return {
    clerkOrgId: "org_acme",
    connectorProvider: null,
    createdAt: new Date("2026-06-06T00:00:00.000Z"),
    id: 1,
    lastRunAt: null,
    name: "Morning check",
    nextRunAt: new Date("2026-06-06T09:00:00.000Z"),
    prompt: "Review overnight changes.",
    publicId: "automation_123",
    scheduleConfig: { time: "09:00" },
    scheduleKind: "daily",
    status: "active",
    timezone: "UTC",
    updatedAt: new Date("2026-06-06T00:00:00.000Z"),
    ...overrides,
  } as Automation;
}
