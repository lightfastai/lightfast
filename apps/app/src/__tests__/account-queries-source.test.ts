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
  it("keeps account cache primitives without a query-options wrapper", () => {
    const queriesPath = "src/account/account-queries.ts";
    const cacheSource = source("src/account/account-cache.ts");
    const profileSource = source(
      "src/account/settings/profile-data-display.tsx"
    );
    const userMenuSource = source("src/components/user-menu.tsx");
    const githubTaskSource = source(
      "src/account/tasks/github-account-task-client.tsx"
    );

    expect(existsSync(resolve(appRoot, queriesPath))).toBe(false);
    expect(cacheSource).toContain('@api/app/tanstack/account"');
    expect(cacheSource).toContain("accountProfileQueryKey");
    expect(cacheSource).toContain("accountGitHubAccountQueryKey");
    expect(cacheSource).toContain("accountMcpConnectionsQueryKey");
    expect(cacheSource).not.toContain("queryOptions");
    expect(cacheSource).not.toContain("getAccountProfile");
    expect(cacheSource).not.toContain("getGitHubAccountStatus");
    expect(profileSource).toContain("getAccountProfile");
    expect(profileSource).toContain("accountProfileQueryKey");
    expect(userMenuSource).toContain("getAccountProfile");
    expect(userMenuSource).toContain("accountProfileQueryKey");
    expect(githubTaskSource).toContain("getGitHubAccountStatus");
    expect(githubTaskSource).toContain("accountGitHubAccountQueryKey");
    expect(cacheSource).not.toContain("mutationOptions");
    expect(cacheSource).not.toContain("updateAccountNameMutationOptions");
    expect(cacheSource).not.toContain("createAccountUsernameMutationOptions");
    expect(cacheSource).not.toContain(
      "startGitHubAccountBindingMutationOptions"
    );
    expect(cacheSource).not.toContain("syncGitHubAccountMutationOptions");
    expect(cacheSource).not.toContain("disconnectGitHubAccountMutationOptions");
    expect(cacheSource).not.toContain("useTRPC");
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
    const cacheSource = source("src/account/account-cache.ts");
    const mcpConnectionsSource = source(
      "src/account/mcp-connections-client.tsx"
    );
    const connectorsSource = source("src/connectors/connectors-client.tsx");

    expect(cacheSource).toContain("accountMcpConnectionsQueryKey");
    expect(mcpConnectionsSource).toContain(
      '@api/app/tanstack/mcp-connections"'
    );
    expect(mcpConnectionsSource).toContain("listAccountMcpConnections");
    expect(mcpConnectionsSource).toContain("accountMcpConnectionsQueryKey");
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
