import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("connectors app data access", () => {
  it("uses local TanStack query helpers backed by api/app server functions", () => {
    const querySource = source("src/connectors/connectors-queries.ts");

    expect(querySource).toContain('@api/app/tanstack/connectors"');
    expect(querySource).toContain("connectorQueryKeys");
    expect(querySource).toContain("connectorsListQueryOptions");
    expect(querySource).toContain("connectorSectionsQueryOptions");
    expect(querySource).not.toContain("mutationOptions");
    expect(querySource).not.toContain("startConnectorMutationOptions");
    expect(querySource).not.toContain("refreshConnectorToolsMutationOptions");
    expect(querySource).not.toContain(
      "setConnectorAutomationEnabledMutationOptions"
    );
    expect(querySource).not.toContain(
      "setConnectorAgentEnabledMutationOptions"
    );
    expect(querySource).not.toContain("disconnectConnectorMutationOptions");
    expect(querySource).not.toContain("useTRPC");
  });

  it("moves connector UI callers off connector tRPC procedures", () => {
    const clientSource = source("src/connectors/connectors-client.tsx");
    const modelSource = source("src/connectors/connectors-model.ts");
    const xSetupSource = source("src/org/setup/x-connector-setup-client.tsx");
    const automationCreateSource = source(
      "src/automations/automation-create-form.tsx"
    );

    expect(clientSource).not.toContain("useTRPC");
    expect(clientSource).not.toContain("org.workspace.connectors");
    expect(clientSource).toContain('@api/app/tanstack/connectors"');
    expect(clientSource).toContain('@api/app/tanstack/user-connectors"');
    expect(clientSource).toContain("connectorSectionsQueryOptions");
    expect(clientSource).toContain("startConnector");
    expect(clientSource).toContain("startUserConnector");
    expect(clientSource).toContain("refreshConnectorTools");
    expect(clientSource).toContain("setConnectorAutomationEnabled");
    expect(clientSource).toContain("setConnectorAgentEnabled");
    expect(clientSource).toContain("disconnectConnector");
    expect(clientSource).toContain("disconnectUserConnector");
    expect(clientSource).not.toContain("startConnectorMutationOptions");
    expect(clientSource).not.toContain("refreshConnectorToolsMutationOptions");
    expect(clientSource).not.toContain(
      "setConnectorAutomationEnabledMutationOptions"
    );
    expect(clientSource).not.toContain(
      "setConnectorAgentEnabledMutationOptions"
    );
    expect(clientSource).not.toContain("disconnectConnectorMutationOptions");
    expect(clientSource).not.toContain("startUserConnectorMutationOptions");
    expect(clientSource).not.toContain(
      "disconnectUserConnectorMutationOptions"
    );
    expect(modelSource).not.toContain("AppRouterOutputs");
    expect(xSetupSource).not.toContain("useTRPC");
    expect(xSetupSource).not.toContain("org.workspace.connectors");
    expect(xSetupSource).toContain('@api/app/tanstack/connectors"');
    expect(xSetupSource).toContain("connectorsListQueryOptions");
    expect(xSetupSource).toContain("startConnector");
    expect(xSetupSource).not.toContain("startConnectorMutationOptions");
    expect(automationCreateSource).not.toContain("org.workspace.connectors");
    expect(automationCreateSource).toContain("connectorsListQueryOptions");
  });

  it("removes the user connector mutation-only helper module", () => {
    expect(
      existsSync(resolve(appRoot, "src/connectors/user-connector-queries.ts"))
    ).toBe(false);
  });
});
