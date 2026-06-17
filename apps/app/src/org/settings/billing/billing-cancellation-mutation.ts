import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelOrgBillingSubscriptionItemMutationOptions,
  orgBillingQueryKeys,
} from "./billing-queries";
import type {
  BillingOverview,
  BillingSubscriptionItem,
} from "./billing-view-model";

export function useCancelSubscriptionItemMutation(input: {
  orgId: string | null | undefined;
}) {
  const queryClient = useQueryClient();
  const overviewQueryKey = orgBillingQueryKeys.overview(input.orgId);

  return useMutation({
    ...cancelOrgBillingSubscriptionItemMutationOptions(),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: overviewQueryKey });

      const previousOverview =
        queryClient.getQueryData<BillingOverview>(overviewQueryKey);
      const canceledAt = Date.now();

      queryClient.setQueryData(
        overviewQueryKey,
        (old: BillingOverview | undefined) =>
          old
            ? {
                ...old,
                subscription: {
                  ...old.subscription,
                  subscriptionItems: old.subscription.subscriptionItems.map(
                    (item) =>
                      item.id === input.subscriptionItemId
                        ? { ...item, canceledAt }
                        : item
                  ),
                },
              }
            : old
      );

      return { previousOverview };
    },
    onError: (_err, _input, context) => {
      if (context?.previousOverview) {
        queryClient.setQueryData(overviewQueryKey, context.previousOverview);
      }
    },
    onSuccess: (updatedItem: BillingSubscriptionItem) => {
      queryClient.setQueryData(
        overviewQueryKey,
        (old: BillingOverview | undefined) =>
          old
            ? {
                ...old,
                subscription: {
                  ...old.subscription,
                  subscriptionItems: old.subscription.subscriptionItems.map(
                    (item) => (item.id === updatedItem.id ? updatedItem : item)
                  ),
                },
              }
            : old
      );
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: overviewQueryKey }),
  });
}
