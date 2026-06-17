import {
  type CancelOrgBillingSubscriptionItemResult,
  cancelOrgBillingSubscriptionItem,
  getOrgBillingOverview,
  type OrgBillingOverviewResult,
} from "@api/app/tanstack/org-billing";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

export type BillingOverview = OrgBillingOverviewResult;
export type BillingPlan = BillingOverview["plans"][number];
export type BillingSubscription = BillingOverview["subscription"];
export type BillingSubscriptionItem =
  BillingSubscription["subscriptionItems"][number];
export type CancelOrgBillingSubscriptionItemData =
  CancelOrgBillingSubscriptionItemResult;

interface CancelOrgBillingSubscriptionItemInput {
  subscriptionItemId: string;
}

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

export function cancelOrgBillingSubscriptionItemMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to schedule cancellation" },
    mutationFn: (
      data: CancelOrgBillingSubscriptionItemInput
    ): Promise<CancelOrgBillingSubscriptionItemData> =>
      cancelOrgBillingSubscriptionItem({ data }),
  });
}
