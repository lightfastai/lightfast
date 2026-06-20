import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("domain command dependency boundaries", () => {
  it("keeps app runtime wiring out of service-backed domain command modules", () => {
    const modules = [
      {
        command: "src/domain/account/commands.ts",
        factory: "createDefaultAccountCommandDeps",
        runtimeImports: [
          "@db/app",
          "@db/app/schema",
          "../../services/github/user-account/flow",
          "@vendor/clerk/server",
        ],
      },
      {
        command: "src/domain/org-api-keys/commands.ts",
        factory: "createDefaultOrgApiKeyCommandDeps",
        runtimeImports: [
          "@vendor/observability/log/next",
          "@vendor/unkey/server",
        ],
      },
      {
        command: "src/domain/mcp-connections/commands.ts",
        factory: "createDefaultMcpConnectionCommandDeps",
        runtimeImports: [
          "getMcpOauthGrantByPublicId",
          "listMcpOauthGrantConnectionsForOrg",
          "listMcpOauthGrantConnectionsForUser",
          "revokeMcpOauthGrant",
        ],
      },
      {
        command: "src/domain/connectors/commands.ts",
        factory: "createDefaultConnectorCommandDeps",
        runtimeImports: [
          "../../services/connectors",
          "../../services/user-connectors/catalog",
        ],
      },
      {
        command: "src/domain/developer-connections/commands.ts",
        factory: "createDefaultDeveloperConnectionCommandDeps",
        runtimeImports: ["../../services/developer-connections"],
      },
      {
        command: "src/domain/org-identity/commands.ts",
        factory: "createDefaultOrgIdentityCommandDeps",
        runtimeImports: [
          "../../services/identity/eligibility",
          "../../services/identity/github",
          "../../inngest/client",
        ],
      },
      {
        command: "src/domain/user-connectors/commands.ts",
        factory: "createDefaultUserConnectorCommandDeps",
        runtimeImports: ["../../services/user-connectors/granola-flow"],
      },
      {
        command: "src/domain/org-members/commands.ts",
        factory: "createDefaultOrgMembersCommandDeps",
        runtimeImports: ["@vendor/clerk/server"],
      },
      {
        command: "src/domain/org-billing/commands.ts",
        factory: "createDefaultOrgBillingCommandDeps",
        runtimeImports: ["@vendor/clerk/server"],
      },
      {
        command: "src/domain/organizations/commands.ts",
        factory: "createDefaultOrganizationCommandDeps",
        runtimeImports: [
          "@vendor/clerk/server",
          "@vendor/observability/error/next",
          "@vendor/observability/log/next",
        ],
      },
      {
        command: "src/domain/signals/commands.ts",
        factory: "createDefaultSignalCommandDeps",
        runtimeImports: ["@db/app", "../../signals/create-signal"],
      },
    ];

    for (const module of modules) {
      const commandSource = source(module.command);
      expect(commandSource).not.toContain(module.factory);

      for (const runtimeImport of module.runtimeImports) {
        expect(commandSource).not.toContain(runtimeImport);
      }
    }

    expect(source("src/domain/account/profile.ts")).not.toContain(
      "@vendor/clerk/server"
    );
  });

  it("keeps concrete app wiring explicit in the TanStack adapter modules", () => {
    const adapterExpectations = [
      {
        adapter: "src/adapters/tanstack/account.ts",
        runtimeImports: [
          "@db/app",
          "../../services/github/user-account/flow",
          "NamespaceConflictError",
        ],
      },
      {
        adapter: "src/adapters/tanstack/org-api-keys.ts",
        runtimeImports: [
          "@vendor/observability/log/next",
          "@vendor/unkey/server",
        ],
      },
      {
        adapter: "src/adapters/tanstack/mcp-connections.ts",
        runtimeImports: [
          "getMcpOauthGrantByPublicId",
          "listMcpOauthGrantConnectionsForOrg",
          "listMcpOauthGrantConnectionsForUser",
          "revokeMcpOauthGrant",
        ],
      },
      {
        adapter: "src/adapters/tanstack/connectors.ts",
        runtimeImports: [
          "../../services/connectors",
          "../../services/user-connectors/catalog",
        ],
      },
      {
        adapter: "src/adapters/tanstack/developer-connections.ts",
        runtimeImports: ["../../services/developer-connections"],
      },
      {
        adapter: "src/adapters/tanstack/org-identity.ts",
        runtimeImports: [
          "../../services/identity/eligibility",
          "../../services/identity/github",
          "../../inngest/client",
        ],
      },
      {
        adapter: "src/adapters/tanstack/user-connectors.ts",
        runtimeImports: ["../../services/user-connectors/granola-flow"],
      },
      {
        adapter: "src/adapters/tanstack/org-members.ts",
        runtimeImports: ["@vendor/clerk/server"],
      },
      {
        adapter: "src/adapters/tanstack/org-billing.ts",
        runtimeImports: ["@vendor/clerk/server"],
      },
      {
        adapter: "src/adapters/tanstack/organizations.ts",
        runtimeImports: [
          "@vendor/clerk/server",
          "@vendor/observability/error/next",
          "@vendor/observability/log/next",
        ],
      },
      {
        adapter: "src/adapters/tanstack/signals.ts",
        runtimeImports: ["@db/app", "../../signals/create-signal"],
      },
    ];

    for (const expectation of adapterExpectations) {
      const adapterSource = source(expectation.adapter);

      for (const runtimeImport of expectation.runtimeImports) {
        expect(adapterSource).toContain(runtimeImport);
      }
    }
  });
});
