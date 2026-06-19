import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

const migratedFiles = [
  "src/components/app-sidebar.tsx",
  "src/account/settings/profile-data-display.tsx",
  "src/account/tasks/username-account-task-client.tsx",
] as const;

describe("account query helpers", () => {
  it("centralizes account query keys and read server function calls", () => {
    const querySource = source("src/account/account-queries.ts");

    expect(querySource).toContain('@api/app/tanstack/account"');
    expect(querySource).toContain("accountQueryKeys");
    expect(querySource).toContain("accountProfileQueryOptions");
    expect(querySource).toContain("githubAccountStatusQueryOptions");
    expect(querySource).not.toContain("mutationOptions");
    expect(querySource).not.toContain("updateAccountNameMutationOptions");
    expect(querySource).not.toContain("createAccountUsernameMutationOptions");
    expect(querySource).not.toContain(
      "startGitHubAccountBindingMutationOptions"
    );
    expect(querySource).not.toContain("syncGitHubAccountMutationOptions");
    expect(querySource).not.toContain("disconnectGitHubAccountMutationOptions");
    expect(querySource).not.toContain("useTRPC");
  });

  it("moves migrated account UI calls off tRPC and keeps shallow mutations local", () => {
    const profileSource = source(
      "src/account/settings/profile-data-display.tsx"
    );
    const usernameSource = source(
      "src/account/tasks/username-account-task-client.tsx"
    );

    expect(profileSource).toContain('@api/app/tanstack/account"');
    expect(profileSource).toContain("updateAccountName");
    expect(profileSource).not.toContain("updateAccountNameMutationOptions");
    expect(usernameSource).toContain('@api/app/tanstack/account"');
    expect(usernameSource).toContain("createAccountUsername");
    expect(usernameSource).not.toContain(
      "createAccountUsernameMutationOptions"
    );

    for (const file of migratedFiles) {
      const fileSource = source(file);
      expect(fileSource, file).not.toContain("viewer.account.get");
      expect(fileSource, file).not.toContain("viewer.account.updateName");
      expect(fileSource, file).not.toContain("viewer.account.createUsername");
    }
  });

  it("moves account connector management off viewer.account tRPC", () => {
    const querySource = source("src/account/account-queries.ts");
    const mcpConnectionsSource = source(
      "src/account/mcp-connections-client.tsx"
    );
    const connectorsSource = source("src/connectors/connectors-client.tsx");

    expect(querySource).toContain("@api/app/tanstack/mcp-connections");
    expect(querySource).toContain("accountMcpConnectionsQueryOptions");
    expect(querySource).not.toContain(
      "revokeAccountMcpConnectionMutationOptions"
    );
    expect(mcpConnectionsSource).toContain(
      '@api/app/tanstack/mcp-connections"'
    );
    expect(mcpConnectionsSource).toContain("revokeAccountMcpConnection");
    expect(mcpConnectionsSource).not.toContain(
      "revokeAccountMcpConnectionMutationOptions"
    );
    expect(
      existsSync(resolve(appRoot, "src/connectors/user-connector-queries.ts"))
    ).toBe(false);
    expect(connectorsSource).toContain('@api/app/tanstack/user-connectors"');
    expect(connectorsSource).toContain("startUserConnector");
    expect(connectorsSource).toContain("disconnectUserConnector");
    expect(connectorsSource).not.toContain("startUserConnectorMutationOptions");
    expect(connectorsSource).not.toContain(
      "disconnectUserConnectorMutationOptions"
    );

    for (const fileSource of [mcpConnectionsSource, connectorsSource]) {
      expect(fileSource).not.toContain("viewer.account.mcpConnections");
      expect(fileSource).not.toContain("viewer.account.userConnectors");
    }
  });

  it("moves migrated GitHub account UI calls off viewer.githubAccount tRPC", () => {
    const migratedGitHubAccountFiles = [
      "src/account/settings/account-source-control-client.tsx",
      "src/account/settings/github-account-card.tsx",
      "src/account/tasks/github-account-task-client.tsx",
      "src/account/tasks/github-account-complete-client.tsx",
    ] as const;

    for (const file of migratedGitHubAccountFiles) {
      const fileSource = source(file);
      expect(fileSource, file).not.toContain(
        "startGitHubAccountBindingMutationOptions"
      );
      expect(fileSource, file).not.toContain(
        "syncGitHubAccountMutationOptions"
      );
      expect(fileSource, file).not.toContain("useTRPC");
      expect(fileSource, file).not.toContain("viewer.githubAccount");
      expect(fileSource, file).not.toContain("AppRouterOutputs");
    }

    expect(
      source("src/account/tasks/github-account-task-client.tsx")
    ).toContain("startGitHubAccountBinding");
    expect(
      source("src/account/tasks/github-account-complete-client.tsx")
    ).toContain("syncGitHubAccount");
  });
});
