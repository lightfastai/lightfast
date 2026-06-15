"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import type { BillingOverview } from "./billing-view-model";

export function useCancelSubscriptionItemMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.org.settings.orgBilling.cancelSubscriptionItem.mutationOptions({
      meta: { errorTitle: "Failed to schedule cancellation" },
      onMutate: async (input) => {
        await queryClient.cancelQueries(
          trpc.org.settings.orgBilling.overview.queryFilter()
        );

        const previousOverview = queryClient.getQueryData<BillingOverview>(
          trpc.org.settings.orgBilling.overview.queryKey()
        );
        const canceledAt = Date.now();

        queryClient.setQueryData(
          trpc.org.settings.orgBilling.overview.queryKey(),
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
          queryClient.setQueryData(
            trpc.org.settings.orgBilling.overview.queryKey(),
            context.previousOverview
          );
        }
      },
      onSuccess: (updatedItem) => {
        queryClient.setQueryData(
          trpc.org.settings.orgBilling.overview.queryKey(),
          (old: BillingOverview | undefined) =>
            old
              ? {
                  ...old,
                  subscription: {
                    ...old.subscription,
                    subscriptionItems: old.subscription.subscriptionItems.map(
                      (item) =>
                        item.id === updatedItem.id ? updatedItem : item
                    ),
                  },
                }
              : old
        );
      },
      onSettled: () =>
        void queryClient.invalidateQueries(
          trpc.org.settings.orgBilling.overview.queryFilter()
        ),
    })
  );
}
