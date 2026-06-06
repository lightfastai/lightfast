import { describe, expect, it } from "vitest";
import {
  type ConnectorCatalogRow,
  connectionStatus,
  displayProviderName,
  filterConnectorCatalogRows,
  isConnectDisabled,
  missingConfigFallback,
  missingConfigMessage,
} from "./connectors-model";

function connector(
  overrides: Partial<ConnectorCatalogRow> = {}
): ConnectorCatalogRow {
  return {
    availableForAutomations: false,
    builder: "Lightfast",
    canManage: true,
    catalogStatus: "available",
    category: "Project management",
    connectAvailability: { status: "available" },
    connection: null,
    description: "Find, create, and manage issues, projects in Linear.",
    displayName: "Linear",
    provider: "linear",
    ...overrides,
  } as ConnectorCatalogRow;
}

function connected(
  overrides: Partial<NonNullable<ConnectorCatalogRow["connection"]>> = {}
): ConnectorCatalogRow {
  return connector({
    availableForAutomations: true,
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
      ...overrides,
    },
  });
}

describe("connectors model", () => {
  it("formats provider and connection status labels", () => {
    expect(displayProviderName(undefined)).toBe("Connector");
    expect(displayProviderName("linear")).toBe("Linear");
    expect(connectionStatus(connected().connection!)).toEqual({
      dotClass: "bg-emerald-500",
      label: "Connected",
    });
    expect(
      connectionStatus(connected({ status: "error" }).connection!)
    ).toEqual({
      dotClass: "bg-destructive",
      label: "Needs reconnect",
    });
    expect(
      connectionStatus(
        connected({
          lastToolRefreshErrorAt: new Date("2026-06-01T00:05:00.000Z"),
        }).connection!
      )
    ).toEqual({
      dotClass: "bg-amber-500",
      label: "Tools stale",
    });
  });

  it("filters rows by search text and connection state", () => {
    const linear = connected();
    const x = connector({
      category: "Social",
      description: "Search posts and look up X accounts from Lightfast.",
      displayName: "X",
      provider: "x",
    });

    expect(
      filterConnectorCatalogRows([linear, x], {
        query: "social",
        statusFilter: "all",
      }).map((row) => row.provider)
    ).toEqual(["x"]);
    expect(
      filterConnectorCatalogRows([linear, x], {
        query: "",
        statusFilter: "connected",
      }).map((row) => row.provider)
    ).toEqual(["linear"]);
    expect(
      filterConnectorCatalogRows([linear, x], {
        query: "",
        statusFilter: "available",
      }).map((row) => row.provider)
    ).toEqual(["x"]);
  });

  it("detects disabled connect states and provider-aware missing config copy", () => {
    const linear = connector({
      connectAvailability: {
        missing: ["LINEAR_CLIENT_ID"],
        reason: "missing_config",
        status: "unavailable",
      },
    });
    const x = connector({ displayName: "X", provider: "x" });

    expect(isConnectDisabled(linear, false)).toBe(true);
    expect(missingConfigMessage(linear)).toBe(
      "Linear OAuth credentials are not configured."
    );
    expect(missingConfigMessage(x)).toBe(
      "X OAuth credentials are not configured."
    );
    expect(missingConfigFallback(x)).toBe("X OAuth");
  });
});
