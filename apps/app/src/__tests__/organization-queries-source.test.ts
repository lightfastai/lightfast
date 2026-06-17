import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

const migratedFiles = [
  "src/components/team-switcher.tsx",
  "src/workspace/workspace-route-shell.tsx",
  "src/account/team-create-client.tsx",
  "src/signals/signal-create-dialog.tsx",
  "src/org/settings/general/team-general-settings-client.tsx",
  "src/org/settings/general/team-general-settings-actions.ts",
  "src/routes/_authenticated/$slug/tasks/index.tsx",
  "src/routes/_authenticated/$slug/tasks/bind/index.tsx",
  "src/routes/_authenticated/$slug/tasks/github/lightfast-repo.tsx",
  "src/routes/_authenticated/$slug/tasks/connectors/x/index.tsx",
] as const;

describe("organization query helpers", () => {
  it("centralizes organization query keys and server function calls", () => {
    const querySource = source("src/organization/organization-queries.ts");

    expect(querySource).toContain('@api/app/tanstack/organizations"');
    expect(querySource).toContain("organizationQueryKeys");
    expect(querySource).toContain("listUserOrganizationsQueryOptions");
    expect(querySource).toContain("organizationBySlugQueryOptions");
    expect(querySource).toContain("organizationDomainsQueryOptions");
    expect(querySource).toContain("createOrganizationMutationOptions");
    expect(querySource).toContain("updateOrganizationDomainsMutationOptions");
    expect(querySource).toContain("updateOrganizationNameMutationOptions");
    expect(querySource).not.toContain("useTRPC");
  });

  it("moves migrated organization UI calls off tRPC", () => {
    for (const file of migratedFiles) {
      const fileSource = source(file);
      expect(fileSource, file).not.toContain("viewer.organization.");
      expect(fileSource, file).not.toContain(
        "org.settings.organization.updateName"
      );
    }
  });

  it("moves organization domain management off tRPC", () => {
    const clientSource = source(
      "src/org/settings/general/team-general-settings-client.tsx"
    );
    const actionsSource = source(
      "src/org/settings/general/team-general-settings-actions.ts"
    );

    expect(clientSource).not.toContain("useTRPC");
    expect(clientSource).not.toContain("org.settings.organization.listDomains");
    expect(actionsSource).not.toContain("useTRPC");
    expect(actionsSource).not.toContain(
      "org.settings.organization.updateDomains"
    );
  });
});
