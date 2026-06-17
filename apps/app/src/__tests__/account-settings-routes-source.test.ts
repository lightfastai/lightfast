import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("app account settings routes", () => {
  it("keeps the account settings layout in an account-owned module", () => {
    const routeSource = source(
      "src/routes/_authenticated/account/settings.tsx"
    );
    const layoutPath = "src/account/settings/account-settings-layout.tsx";

    expect(
      existsSync(resolve(appRoot, layoutPath)),
      `${layoutPath} should exist`
    ).toBe(true);
    const layoutSource = source(layoutPath);

    expect(routeSource).toContain("AccountSettingsLayout");
    expect(routeSource).not.toContain("SettingsSidebar");
    expect(routeSource).not.toContain("Source Control & Git");

    expect(layoutSource).toContain("SettingsSidebar");
    expect(layoutSource).toContain("Source Control & Git");
    expect(layoutSource).toContain("<Outlet />");
  });

  it("keeps team creation behavior in an account-owned client module", () => {
    const routeSource = source(
      "src/routes/_authenticated/account/teams/new.tsx"
    );
    const clientPath = "src/account/team-create-client.tsx";

    expect(
      existsSync(resolve(appRoot, clientPath)),
      `${clientPath} should exist`
    ).toBe(true);
    const clientSource = source(clientPath);

    expect(routeSource).toContain("CreateTeamClient");
    expect(routeSource).not.toContain("normalizeTeamSlug");
    expect(routeSource).not.toContain("createTeamIdempotencyKey");
    expect(routeSource).not.toContain("viewer.organization.create");

    expect(clientSource).toContain("normalizeTeamSlug");
    expect(clientSource).toContain("createTeamIdempotencyKey");
    expect(clientSource).toContain("createOrganizationMutationOptions");
    expect(clientSource).toContain("organizationQueryKeys");
    expect(clientSource).not.toContain("viewer.organization.create");
    expect(clientSource).toContain('await navigate({ to: "/$slug"');
  });

  it("preserves connector callback search params when redirecting to general settings", () => {
    const settingsRouteSource = source(
      "src/routes/_authenticated/account/settings.tsx"
    );
    const settingsIndexRouteSource = source(
      "src/routes/_authenticated/account/settings/index.tsx"
    );

    expect(settingsRouteSource).toContain("search: location.search");
    expect(settingsRouteSource).toContain('to: "/account/settings/general"');
    expect(settingsIndexRouteSource).toContain(
      "const search = Route.useSearch"
    );
    expect(settingsIndexRouteSource).toContain("search={search}");
  });

  it("keeps profile data on the loading shell until client mount", () => {
    const profileSource = source(
      "src/account/settings/profile-data-display.tsx"
    );

    expect(profileSource).toContain('from "@repo/ui/hooks/use-mounted"');
    expect(profileSource).toContain("const mounted = useMounted();");
    expect(profileSource).toContain("if (!mounted || isPending || !profile)");
  });
});
