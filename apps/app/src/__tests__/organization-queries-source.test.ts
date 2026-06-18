import { existsSync, readFileSync } from "node:fs";
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
  "src/org/settings/general/team-general-settings-model.ts",
  "src/routes/_authenticated/$slug/tasks/index.tsx",
  "src/routes/_authenticated/$slug/tasks/bind/index.tsx",
  "src/routes/_authenticated/$slug/tasks/github/lightfast-repo.tsx",
  "src/routes/_authenticated/$slug/tasks/connectors/x/index.tsx",
] as const;

describe("organization query helpers", () => {
  it("centralizes organization query keys and read server function calls", () => {
    const querySource = source("src/organization/organization-queries.ts");

    expect(querySource).toContain('@api/app/tanstack/organizations"');
    expect(querySource).toContain("organizationQueryKeys");
    expect(querySource).toContain("listUserOrganizationsQueryOptions");
    expect(querySource).toContain("organizationBySlugQueryOptions");
    expect(querySource).toContain("organizationDomainsQueryOptions");
    expect(querySource).not.toContain("mutationOptions");
    expect(querySource).not.toContain("createOrganizationMutationOptions");
    expect(querySource).not.toContain(
      "updateOrganizationDomainsMutationOptions"
    );
    expect(querySource).not.toContain("updateOrganizationNameMutationOptions");
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
    const modelSource = source(
      "src/org/settings/general/team-general-settings-model.ts"
    );
    const actionsPath =
      "src/org/settings/general/team-general-settings-actions.ts";

    expect(clientSource).not.toContain("useTRPC");
    expect(clientSource).not.toContain("org.settings.organization.listDomains");
    expect(existsSync(resolve(appRoot, actionsPath))).toBe(false);
    expect(modelSource).not.toContain("useTRPC");
    expect(modelSource).not.toContain(
      "org.settings.organization.updateDomains"
    );
  });

  it("keeps team general mutation state in the client and pure helpers in the model", () => {
    const clientSource = source(
      "src/org/settings/general/team-general-settings-client.tsx"
    );
    const modelSource = source(
      "src/org/settings/general/team-general-settings-model.ts"
    );
    const actionsPath =
      "src/org/settings/general/team-general-settings-actions.ts";

    expect(existsSync(resolve(appRoot, actionsPath))).toBe(false);
    expect(clientSource).toContain("useMutation");
    expect(clientSource).toContain("useQueryClient");
    expect(clientSource).toContain('@api/app/tanstack/organizations"');
    expect(clientSource).toContain("updateOrganizationName");
    expect(clientSource).toContain("updateOrganizationDomains");
    expect(clientSource).not.toContain("updateOrganizationNameMutationOptions");
    expect(clientSource).not.toContain(
      "updateOrganizationDomainsMutationOptions"
    );
    expect(clientSource).toContain("organizationQueryKeys.domains(slug)");
    expect(clientSource).toContain("renameOrganizationSlug");
    expect(clientSource).not.toContain("useTeamNameUpdate");
    expect(clientSource).not.toContain("useTeamDomainsUpdate");
    expect(clientSource).not.toContain("team-general-settings-actions");

    expect(modelSource).toContain("normalizeTeamSlugInput");
    expect(modelSource).toContain("normalizeTeamDomainList");
    expect(modelSource).toContain("renameOrganizationSlug");
    expect(modelSource).not.toContain("useMutation");
    expect(modelSource).not.toContain("toast.");
  });
});
