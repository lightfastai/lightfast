import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorDetailSheet } from "./connector-detail-sheet";
import type { ConnectorCatalogRow } from "./connectors-model";

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: { error: toastMocks.error, success: toastMocks.success },
}));

function connectedRow(): ConnectorCatalogRow {
  return {
    availableForAutomations: true,
    builder: "Lightfast",
    canManage: true,
    catalogStatus: "available",
    category: "Project management",
    connectAvailability: { status: "available" },
    connection: {
      connectedAt: new Date("2026-06-01T00:00:00.000Z"),
      enabledForAgents: false,
      enabledForAutomations: true,
      lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
      lastToolRefreshErrorAt: null,
      lastToolRefreshErrorCode: null,
      providerActorName: "Lightfast App",
      providerWorkspaceName: "Acme Linear",
      status: "active",
      tools: [
        {
          availableForAgents: false,
          availableForAutomations: true,
          description: "Create a Linear issue",
          name: "create_issue",
        },
      ],
    },
    description: "Find, create, and manage issues, projects in Linear.",
    displayName: "Linear",
    provider: "linear",
  } as ConnectorCatalogRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("ConnectorDetailSheet", () => {
  it("renders the connector detail when a connected row is provided", () => {
    render(
      <ConnectorDetailSheet onOpenChange={vi.fn()} row={connectedRow()} />
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-describedby");
    expect(
      screen.getAllByRole("heading", { name: "Linear" }).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("create_issue")).toBeInTheDocument();
  });

  it("does not render the dialog when no row is provided", () => {
    render(<ConnectorDetailSheet onOpenChange={vi.fn()} row={undefined} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an error toast when copying the link fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(
      <ConnectorDetailSheet onOpenChange={vi.fn()} row={connectedRow()} />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("Unable to copy link")
    );
    expect(toastMocks.success).not.toHaveBeenCalled();
  });
});
