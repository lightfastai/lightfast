import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectorDetailContent } from "./connector-detail-content";
import type { ConnectorCatalogRow } from "./connectors-model";

function connectedRow(
  overrides: Partial<NonNullable<ConnectorCatalogRow["connection"]>> = {}
): ConnectorCatalogRow {
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
        {
          availableForAgents: false,
          availableForAutomations: false,
          description: "Search Linear issues",
          name: "search_issues",
        },
      ],
      ...overrides,
    },
    description: "Find, create, and manage issues, projects in Linear.",
    displayName: "Linear",
    provider: "linear",
  } as ConnectorCatalogRow;
}

describe("ConnectorDetailContent", () => {
  it("renders identity, automations, and the tools list for a connected row", () => {
    render(
      <ConnectorDetailContent onCopyLink={vi.fn()} row={connectedRow()} />
    );

    expect(screen.getByRole("heading", { name: "Linear" })).toBeInTheDocument();
    expect(screen.getByText("Acme Linear")).toBeInTheDocument();
    expect(screen.getByText("Lightfast App")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("create_issue")).toBeInTheDocument();
    expect(screen.getByText("search_issues")).toBeInTheDocument();
  });

  it("hides workspace/account rows when those fields are null", () => {
    render(
      <ConnectorDetailContent
        onCopyLink={vi.fn()}
        row={connectedRow({
          providerActorName: null,
          providerWorkspaceName: null,
        })}
      />
    );

    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
  });

  it("renders the Disabled automations pill", () => {
    render(
      <ConnectorDetailContent
        onCopyLink={vi.fn()}
        row={connectedRow({
          enabledForAgents: true,
          enabledForAutomations: false,
        })}
      />
    );

    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("renders the Enabled agents pill", () => {
    render(
      <ConnectorDetailContent
        onCopyLink={vi.fn()}
        row={connectedRow({ enabledForAgents: true })}
      />
    );

    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getAllByText("Enabled").length).toBeGreaterThan(1);
  });

  it("renders the tools-stale error code", () => {
    render(
      <ConnectorDetailContent
        onCopyLink={vi.fn()}
        row={connectedRow({
          lastToolRefreshErrorAt: new Date("2026-06-01T00:05:00.000Z"),
          lastToolRefreshErrorCode: "linear_unavailable",
        })}
      />
    );

    expect(screen.getAllByText("Tools stale").length).toBeGreaterThan(0);
    expect(screen.getByText("linear_unavailable")).toBeInTheDocument();
  });

  it("invokes onCopyLink when the copy-link button is clicked", () => {
    const onCopyLink = vi.fn();
    render(
      <ConnectorDetailContent onCopyLink={onCopyLink} row={connectedRow()} />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });
});
