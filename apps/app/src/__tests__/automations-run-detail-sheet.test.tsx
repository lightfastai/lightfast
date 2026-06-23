// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutomationRunDetailSheet } from "~/automations/automation-run-detail-sheet";
import type { AutomationRunListItem } from "~/automations/automations-cache";

type AutomationRun = AutomationRunListItem;

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isError: false }),
}));

vi.mock("@api/app/tanstack/automations", () => ({
  getAutomationRun: vi.fn(),
}));

vi.mock("~/automations/automation-run-detail-content", () => ({
  AutomationRunDetailContent: ({
    closeSlot,
    run,
  }: {
    closeSlot: ReactNode;
    run: AutomationRun;
  }) => (
    <section>
      <p>{run.publicId}</p>
      {closeSlot}
    </section>
  ),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@repo/ui/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? children : null,
  SheetClose: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: ({
    children,
    ...props
  }: ComponentProps<"div"> & { showCloseButton?: boolean; side?: string }) => (
    <div
      aria-describedby="automation-run-sheet-description"
      aria-labelledby="automation-run-sheet-title"
      role="dialog"
      {...props}
    >
      {children}
    </div>
  ),
  SheetDescription: ({ children }: { children: ReactNode }) => (
    <p id="automation-run-sheet-description">{children}</p>
  ),
  SheetHeader: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
  SheetTitle: ({ children }: { children: ReactNode }) => (
    <h2 id="automation-run-sheet-title">{children}</h2>
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

describe("AutomationRunDetailSheet", () => {
  it("associates the run details dialog with an accessible description", () => {
    render(
      <AutomationRunDetailSheet
        initialRun={run()}
        onOpenChange={vi.fn()}
        publicId="automation_run_123"
      />
    );

    const dialog = screen.getByRole("dialog");
    const descriptionId = dialog.getAttribute("aria-describedby");

    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId ?? "")?.textContent).toBe(
      "Automation run details"
    );
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
