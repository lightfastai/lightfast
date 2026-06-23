import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("developer-connections app data access", () => {
  it("inlines the single-use list query instead of hiding it behind a helper", () => {
    expect(
      existsSync(
        resolve(
          appRoot,
          "src/developer-connections/developer-connections-queries.ts"
        )
      )
    ).toBe(false);

    const clientSource = source(
      "src/developer-connections/developer-connections-client.tsx"
    );

    expect(clientSource).toContain('@api/app/tanstack/developer-connections"');
    expect(clientSource).toContain("listDeveloperConnections");
    expect(clientSource).toContain("developerConnectionListQueryKey");
    expect(clientSource).toContain("queryFn: () => listDeveloperConnections()");
    expect(clientSource).toContain("queryKey: developerConnectionListQueryKey");
    expect(clientSource).not.toContain("developerConnectionsQueryOptions");
    expect(clientSource).not.toContain("developerConnectionQueryKeys");
    expect(clientSource).not.toContain(
      "src/developer-connections/developer-connections-queries.ts"
    );
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
