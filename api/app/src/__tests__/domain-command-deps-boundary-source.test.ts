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
          "../../services/github/user-account/flow",
          "@vendor/clerk/server",
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
    ];

    for (const module of modules) {
      const commandSource = source(module.command);
      expect(commandSource).not.toContain(module.factory);

      for (const runtimeImport of module.runtimeImports) {
        expect(commandSource).not.toContain(runtimeImport);
      }
    }
  });

  it("keeps concrete app wiring explicit in the TanStack adapter modules", () => {
    const adapterExpectations = [
      {
        adapter: "src/adapters/tanstack/account.ts",
        runtimeImports: ["../../services/github/user-account/flow"],
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
    ];

    for (const expectation of adapterExpectations) {
      const adapterSource = source(expectation.adapter);

      for (const runtimeImport of expectation.runtimeImports) {
        expect(adapterSource).toContain(runtimeImport);
      }
    }
  });
});
