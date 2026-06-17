import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("org identity app data access", () => {
  it("uses local TanStack query helpers backed by api/app server functions", () => {
    const source = readFileSync(
      resolve(appRoot, "src/org/settings/general/identity-soul-queries.ts"),
      "utf8"
    );

    expect(source).toContain('@api/app/tanstack/org-identity"');
    expect(source).toContain("queryOptions");
    expect(source).not.toContain("useTRPC");
    expect(source).not.toContain('enabled: typeof window !== "undefined"');
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

    expect(cardSource).not.toContain("useTRPC");
    expect(cardSource).not.toContain("org.settings.identity");
    expect(sectionSource).not.toContain("AppRouterOutputs");
  });
});
