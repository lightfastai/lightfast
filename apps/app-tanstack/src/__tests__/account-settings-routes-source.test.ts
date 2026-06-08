import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("app-tanstack account settings routes", () => {
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
