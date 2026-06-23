import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("connectors app data access", () => {
  it("removes the connector cache module instead of hiding simple query keys", () => {
    const cachePath = resolve(appRoot, "src/connectors/connectors-cache.ts");
    const modelSource = source("src/connectors/connectors-model.ts");

    expect(
      existsSync(resolve(appRoot, "src/connectors/connectors-queries.ts"))
    ).toBe(false);
    expect(existsSync(cachePath)).toBe(false);
    expect(modelSource).toContain('@api/app/tanstack/connectors"');
    expect(modelSource).not.toContain("connectors-cache");
    expect(modelSource).not.toContain("connectorQueryKeys");
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
    expect(clientSource).toContain("listConnectorSections");
    expect(clientSource).toContain(
      'queryKey: ["connectors", "sections"] as const'
    );
    expect(clientSource).toContain('queryKey: ["connectors"] as const');
    expect(clientSource).not.toContain("connectorQueryKeys");
    expect(clientSource).not.toContain("connectors-cache");
    expect(clientSource).not.toContain("connectorSectionsQueryOptions");
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
    expect(xSetupSource).toContain("listConnectors");
    expect(xSetupSource).toContain('queryKey: ["connectors", "list"] as const');
    expect(xSetupSource).not.toContain("connectorQueryKeys");
    expect(xSetupSource).not.toContain("connectors-cache");
    expect(xSetupSource).not.toContain("connectorsListQueryOptions");
    expect(xSetupSource).toContain("startConnector");
    expect(xSetupSource).not.toContain("startConnectorMutationOptions");
    expect(automationCreateSource).not.toContain("org.workspace.connectors");
    expect(automationCreateSource).toContain("listConnectors");
    expect(automationCreateSource).toContain(
      'queryKey: ["connectors", "list"] as const'
    );
    expect(automationCreateSource).not.toContain("connectorQueryKeys");
    expect(automationCreateSource).not.toContain("connectors-cache");
    expect(automationCreateSource).not.toContain("connectorsListQueryOptions");
  });

  it("removes the user connector mutation-only helper module", () => {
    expect(
      existsSync(resolve(appRoot, "src/connectors/user-connector-queries.ts"))
    ).toBe(false);
  });
});
