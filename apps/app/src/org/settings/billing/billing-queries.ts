import {
  getOrgBillingOverview,
  type OrgBillingOverviewResult,
} from "@api/app/tanstack/org-billing";
import { queryOptions } from "@tanstack/react-query";

export type BillingOverview = OrgBillingOverviewResult;
export type BillingPlan = BillingOverview["plans"][number];
export type BillingSubscription = BillingOverview["subscription"];
export type BillingSubscriptionItem =
  BillingSubscription["subscriptionItems"][number];

export const orgBillingQueryKeys = {
  all: ["org-billing"] as const,
  overview: (orgId: string | null | undefined) =>
    ["org-billing", "overview", orgId ?? "no-org"] as const,
};

export function billingOverviewQueryOptions(input: {
  orgId: string | null | undefined;
}) {
  return queryOptions({
    enabled: Boolean(input.orgId),
    queryFn: () => getOrgBillingOverview(),
    queryKey: orgBillingQueryKeys.overview(input.orgId),
    staleTime: 5 * 60 * 1000,
  });
}
