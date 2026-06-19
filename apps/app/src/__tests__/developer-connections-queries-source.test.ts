import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("developer-connections app data access", () => {
  it("uses local TanStack query helpers backed by api/app server functions", () => {
    const querySource = source(
      "src/developer-connections/developer-connections-queries.ts"
    );

    expect(querySource).toContain('@api/app/tanstack/developer-connections"');
    expect(querySource).toContain("developerConnectionQueryKeys");
    expect(querySource).toContain("developerConnectionsQueryOptions");
    expect(querySource).not.toContain("mutationOptions");
    expect(querySource).not.toContain(
      "connectDeveloperConnectionMutationOptions"
    );
    expect(querySource).not.toContain(
      "startSentryDeveloperConnectionAuthMutationOptions"
    );
    expect(querySource).not.toContain(
      "completeSentryDeveloperConnectionAuthMutationOptions"
    );
    expect(querySource).not.toContain(
      "setDeveloperConnectionSandboxEnabledMutationOptions"
    );
    expect(querySource).not.toContain(
      "disconnectDeveloperConnectionMutationOptions"
    );
    expect(querySource).not.toContain("useTRPC");
  });

  it("moves the developer-connections UI off tRPC", () => {
    const clientSource = source(
      "src/developer-connections/developer-connections-client.tsx"
    );
    const modelSource = source(
      "src/developer-connections/developer-connections-model.ts"
    );

    expect(clientSource).not.toContain("useTRPC");
    expect(clientSource).not.toContain("org.workspace.developerConnections");
    expect(clientSource).toContain('@api/app/tanstack/developer-connections"');
    expect(clientSource).toContain("developerConnectionsQueryOptions");
    expect(clientSource).toContain("connectDeveloperConnection");
    expect(clientSource).toContain("startSentryDeveloperConnectionAuth");
    expect(clientSource).toContain("completeSentryDeveloperConnectionAuth");
    expect(clientSource).toContain("setDeveloperConnectionSandboxEnabled");
    expect(clientSource).toContain("disconnectDeveloperConnection");
    expect(clientSource).not.toContain(
      "connectDeveloperConnectionMutationOptions"
    );
    expect(clientSource).not.toContain(
      "startSentryDeveloperConnectionAuthMutationOptions"
    );
    expect(clientSource).not.toContain(
      "completeSentryDeveloperConnectionAuthMutationOptions"
    );
    expect(clientSource).not.toContain(
      "setDeveloperConnectionSandboxEnabledMutationOptions"
    );
    expect(clientSource).not.toContain(
      "disconnectDeveloperConnectionMutationOptions"
    );
    expect(modelSource).not.toContain("AppRouterOutputs");
  });
});
