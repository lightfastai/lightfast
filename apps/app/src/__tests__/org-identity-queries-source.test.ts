import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("org identity app data access", () => {
  it("inlines the single-use identity query instead of hiding it behind a helper", () => {
    expect(
      existsSync(
        resolve(appRoot, "src/org/settings/general/identity-soul-queries.ts")
      )
    ).toBe(false);

    const cardSource = readFileSync(
      resolve(appRoot, "src/org/settings/general/identity-soul-card.tsx"),
      "utf8"
    );

    expect(cardSource).toContain('@api/app/tanstack/org-identity"');
    expect(cardSource).toContain("getOrgIdentity");
    expect(cardSource).toContain("orgIdentityQueryKey");
    expect(cardSource).toContain("queryFn: () => getOrgIdentity()");
    expect(cardSource).toContain("queryKey: orgIdentityQueryKey");
    expect(cardSource).not.toContain("orgIdentityQueryOptions");
    expect(cardSource).not.toContain("orgIdentityQueryKeys");
    expect(cardSource).not.toContain("identity-soul-queries");
    expect(cardSource).not.toContain("useTRPC");
    expect(cardSource).not.toContain('enabled: typeof window !== "undefined"');
  });

  it("removes identity settings UI callers from tRPC", () => {
    const cardSource = readFileSync(
      resolve(appRoot, "src/org/settings/general/identity-soul-card.tsx"),
      "utf8"
    );
    const sectionSource = readFileSync(
      resolve(appRoot, "src/org/settings/general/identity-soul-section.tsx"),
      "utf8"
    );

    expect(cardSource).toContain('@api/app/tanstack/org-identity"');
    expect(cardSource).not.toContain("useTRPC");
    expect(cardSource).not.toContain("org.settings.identity");
    expect(sectionSource).toContain('@api/app/tanstack/org-identity"');
    expect(sectionSource).not.toContain("identity-soul-queries");
    expect(sectionSource).not.toContain("AppRouterOutputs");
  });
});
