import { readFileSync } from "node:fs";
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
    expect(querySource).toContain("startConnectorMutationOptions");
    expect(querySource).toContain("refreshConnectorToolsMutationOptions");
    expect(querySource).toContain(
      "setConnectorAutomationEnabledMutationOptions"
    );
    expect(querySource).toContain("setConnectorAgentEnabledMutationOptions");
    expect(querySource).toContain("disconnectConnectorMutationOptions");
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
    expect(clientSource).toContain("connectorSectionsQueryOptions");
    expect(clientSource).toContain("startConnectorMutationOptions");
    expect(clientSource).toContain("refreshConnectorToolsMutationOptions");
    expect(clientSource).toContain(
      "setConnectorAutomationEnabledMutationOptions"
    );
    expect(clientSource).toContain("setConnectorAgentEnabledMutationOptions");
    expect(clientSource).toContain("disconnectConnectorMutationOptions");
    expect(modelSource).not.toContain("AppRouterOutputs");
    expect(xSetupSource).not.toContain("useTRPC");
    expect(xSetupSource).not.toContain("org.workspace.connectors");
    expect(xSetupSource).toContain("connectorsListQueryOptions");
    expect(xSetupSource).toContain("startConnectorMutationOptions");
    expect(automationCreateSource).not.toContain("org.workspace.connectors");
    expect(automationCreateSource).toContain("connectorsListQueryOptions");
  });
});
