import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

const migratedFiles = [
  "src/components/app-sidebar.tsx",
  "src/account/settings/profile-data-display.tsx",
  "src/account/settings/account-settings-actions.ts",
  "src/account/tasks/username-account-task-client.tsx",
] as const;

describe("account query helpers", () => {
  it("centralizes account query keys and server function calls", () => {
    const querySource = source("src/account/account-queries.ts");

    expect(querySource).toContain('@api/app/tanstack/account"');
    expect(querySource).toContain("accountQueryKeys");
    expect(querySource).toContain("accountProfileQueryOptions");
    expect(querySource).toContain("updateAccountNameMutationOptions");
    expect(querySource).toContain("createAccountUsernameMutationOptions");
    expect(querySource).not.toContain("useTRPC");
  });

  it("moves migrated account UI calls off tRPC", () => {
    for (const file of migratedFiles) {
      const fileSource = source(file);
      expect(fileSource, file).not.toContain("viewer.account.get");
      expect(fileSource, file).not.toContain("viewer.account.updateName");
      expect(fileSource, file).not.toContain("viewer.account.createUsername");
    }
  });

  it("leaves account connector management on tRPC for later product slices", () => {
    const mcpConnectionsSource = source(
      "src/account/mcp-connections-client.tsx"
    );
    const connectorsSource = source("src/connectors/connectors-client.tsx");

    expect(mcpConnectionsSource).toContain("viewer.account.mcpConnections");
    expect(connectorsSource).toContain("viewer.account.userConnectors");
  });
});
