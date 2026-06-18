import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("org billing app data access", () => {
  it("uses local TanStack query helpers backed by api/app server functions", () => {
    const source = readFileSync(
      resolve(appRoot, "src/org/settings/billing/billing-queries.ts"),
      "utf8"
    );

    expect(source).toContain('@api/app/tanstack/org-billing"');
    expect(source).toContain("queryOptions");
    expect(source).toContain("mutationOptions");
    expect(source).toContain('["org-billing", "overview", orgId ?? "no-org"]');
    expect(source).toContain("enabled: Boolean(input.orgId)");
    expect(source).not.toContain("useTRPC");
    expect(source).not.toContain('enabled: typeof window !== "undefined"');
  });

  it("removes org billing settings UI callers from tRPC", () => {
    const files = [
      "src/org/settings/billing/billing-settings-client.tsx",
      "src/org/settings/billing/billing-cancellation-mutation.ts",
      "src/org/settings/billing/billing-view-model.ts",
      "src/org/settings/billing/plan-selection-dialog.tsx",
      "src/org/settings/billing/plan-dialogs.tsx",
      "src/org/settings/billing/billing-sections.tsx",
      "src/org/settings/billing/billing-checkout-dialog.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(resolve(appRoot, file), "utf8");
      expect(source, file).not.toContain("useTRPC");
      expect(source, file).not.toContain("org.settings.orgBilling");
      expect(source, file).not.toContain("AppRouterOutputs");
    }
  });

  it("keeps the billing overview refresh mutation state in the billing client", () => {
    const clientSource = readFileSync(
      resolve(appRoot, "src/org/settings/billing/billing-settings-client.tsx"),
      "utf8"
    );
    const actionsPath = "src/org/settings/billing/billing-overview-actions.ts";

    expect(existsSync(resolve(appRoot, actionsPath))).toBe(false);
    expect(clientSource).toContain("useQueryClient");
    expect(clientSource).toContain("orgBillingQueryKeys.overview(auth.orgId)");
    expect(clientSource).not.toContain("useBillingOverviewRefresh");
    expect(clientSource).not.toContain("billing-overview-actions");
  });
});
