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
  it("uses local account query keys without a query-options wrapper", () => {
    const queriesPath = "src/account/account-queries.ts";
    const profileSource = source(
      "src/account/settings/profile-data-display.tsx"
    );
    const userMenuSource = source("src/components/user-menu.tsx");
    const githubTaskSource = source(
      "src/account/tasks/github-account-task-client.tsx"
    );

    expect(existsSync(resolve(appRoot, queriesPath))).toBe(false);
    expect(existsSync(resolve(appRoot, "src/account/account-cache.ts"))).toBe(
      false
    );
    expect(profileSource).toContain("getAccountProfile");
    expect(profileSource).toContain("accountProfileQueryKey");
    expect(profileSource).toContain('["account", "profile"] as const');
    expect(userMenuSource).toContain("getAccountProfile");
    expect(userMenuSource).toContain("accountProfileQueryKey");
    expect(userMenuSource).toContain('["account", "profile"] as const');
    expect(githubTaskSource).toContain("getGitHubAccountStatus");
    expect(githubTaskSource).toContain("accountGitHubAccountQueryKey");
    expect(githubTaskSource).toContain('["account", "github"] as const');

    for (const fileSource of [
      profileSource,
      userMenuSource,
      githubTaskSource,
    ]) {
      expect(fileSource).not.toContain("queryOptions");
      expect(fileSource).not.toContain("mutationOptions");
      expect(fileSource).not.toContain("useTRPC");
    }
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
    const mcpConnectionsSource = source(
      "src/account/mcp-connections-client.tsx"
    );
    const connectorsSource = source("src/connectors/connectors-client.tsx");

    expect(existsSync(resolve(appRoot, "src/account/account-cache.ts"))).toBe(
      false
    );
    expect(mcpConnectionsSource).toContain(
      '@api/app/tanstack/mcp-connections"'
    );
    expect(mcpConnectionsSource).toContain("listAccountMcpConnections");
    expect(mcpConnectionsSource).toContain("accountMcpConnectionsQueryKey");
    expect(mcpConnectionsSource).toContain('"mcp-connections"');
    expect(mcpConnectionsSource).toContain("revokeAccountMcpConnection");
    expect(mcpConnectionsSource).not.toContain(
      "accountMcpConnectionsQueryOptions"
    );
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
      source("src/account/tasks/github-account-task-client.tsx")
    ).toContain("getGitHubAccountStatus");
    expect(
      source("src/account/tasks/github-account-complete-client.tsx")
    ).toContain("syncGitHubAccount");
  });
});
