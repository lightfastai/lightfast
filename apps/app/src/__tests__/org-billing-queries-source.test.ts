import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("org billing app data access", () => {
  it("keeps billing overview query wiring local to the billing client", () => {
    const queriesPath = "src/org/settings/billing/billing-queries.ts";
    const clientSource = readFileSync(
      resolve(appRoot, "src/org/settings/billing/billing-settings-client.tsx"),
      "utf8"
    );

    expect(existsSync(resolve(appRoot, queriesPath))).toBe(false);
    expect(clientSource).toContain('@api/app/tanstack/org-billing"');
    expect(clientSource).toContain("getOrgBillingOverview");
    expect(clientSource).toContain("orgBillingOverviewQueryKey(auth.orgId)");
    expect(clientSource).toContain("queryFn: () => getOrgBillingOverview()");
    expect(clientSource).toContain("enabled: Boolean(auth.orgId)");
    expect(clientSource).not.toContain("billingOverviewQueryOptions");
    expect(clientSource).not.toContain("orgBillingQueryKeys");
    expect(clientSource).not.toContain(
      "cancelOrgBillingSubscriptionItemMutationOptions"
    );
    expect(clientSource).not.toContain("useTRPC");
    expect(clientSource).not.toContain(
      'enabled: typeof window !== "undefined"'
    );
  });

  it("removes org billing settings UI callers from tRPC", () => {
    const files = [
      "src/org/settings/billing/billing-settings-client.tsx",
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
    expect(clientSource).toContain("orgBillingOverviewQueryKey(auth.orgId)");
    expect(clientSource).not.toContain("useBillingOverviewRefresh");
    expect(clientSource).not.toContain("billing-overview-actions");
  });

  it("keeps the billing cancellation mutation state in the billing client", () => {
    const clientSource = readFileSync(
      resolve(appRoot, "src/org/settings/billing/billing-settings-client.tsx"),
      "utf8"
    );
    const mutationPath =
      "src/org/settings/billing/billing-cancellation-mutation.ts";

    expect(existsSync(resolve(appRoot, mutationPath))).toBe(false);
    expect(clientSource).toContain('@api/app/tanstack/org-billing"');
    expect(clientSource).toContain("cancelOrgBillingSubscriptionItem");
    expect(clientSource).toContain("useMutation");
    expect(clientSource).not.toContain(
      "cancelOrgBillingSubscriptionItemMutationOptions"
    );
    expect(clientSource).toContain("orgBillingOverviewQueryKey(auth.orgId)");
    expect(clientSource).toContain("previousOverview");
    expect(clientSource).not.toContain("useCancelSubscriptionItemMutation");
    expect(clientSource).not.toContain("billing-cancellation-mutation");
  });
});
