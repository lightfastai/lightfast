import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("org members app data access", () => {
  it("uses local TanStack query helpers backed by api/app server functions", () => {
    const source = readFileSync(
      resolve(appRoot, "src/org/settings/members/org-member-queries.ts"),
      "utf8"
    );

    expect(source).toContain('@api/app/tanstack/org-members"');
    expect(source).toContain("queryOptions");
    expect(source).toContain("mutationOptions");
    expect(source).toContain('["org-members", "list", orgId ?? "no-org"]');
    expect(source).toContain("enabled: Boolean(input.orgId)");
    expect(source).not.toContain("useTRPC");
    expect(source).not.toContain('enabled: typeof window !== "undefined"');
  });

  it("removes org member settings UI callers from tRPC", () => {
    const files = [
      "src/org/settings/members/org-member-list.tsx",
      "src/org/settings/members/org-member-list-actions.ts",
      "src/org/settings/members/org-member-invite-actions.ts",
      "src/org/settings/members/org-member-cache.ts",
      "src/signals/signals-creator-avatar.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(resolve(appRoot, file), "utf8");
      expect(source, file).not.toContain("useTRPC");
      expect(source, file).not.toContain("org.settings.orgMembers");
      expect(source, file).not.toContain("AppRouterOutputs");
    }
  });

  it("surfaces expected domain errors from TanStack mutations", () => {
    const source = readFileSync(resolve(appRoot, "src/trpc/react.tsx"), "utf8");

    expect(source).toContain("isExpectedDomainError");
    expect(source).toContain('error.name === "DomainError"');
    expect(source).toContain("message = error.message");
  });
});
