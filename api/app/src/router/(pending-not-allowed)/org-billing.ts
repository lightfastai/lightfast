import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient, toPlainClerkResource } from "@vendor/clerk/server";
import { z } from "zod";

import { orgAdminProcedure, orgProcedure } from "../../trpc";

export const orgBillingRouter = {
  overview: orgProcedure.query(async ({ ctx }) => {
    const clerk = await clerkClient();
    const [plans, subscription] = await Promise.all([
      clerk.billing.getPlanList({ limit: 100, payerType: "org" }),
      clerk.billing.getOrganizationBillingSubscription(ctx.auth.identity.orgId),
    ]);

    return {
      plans: toPlainClerkResource(plans.data),
      subscription: toPlainClerkResource(subscription),
    };
  }),

  cancelSubscriptionItem: orgAdminProcedure
    .input(z.object({ subscriptionItemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      const subscription =
        await clerk.billing.getOrganizationBillingSubscription(
          ctx.auth.identity.orgId
        );
      const item = subscription.subscriptionItems.find(
        (subscriptionItem) => subscriptionItem.id === input.subscriptionItemId
      );
      if (!item) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Subscription item does not belong to this organization",
        });
      }
      if (item.plan?.slug !== "team") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only the Team plan can be canceled",
        });
      }

      const canceledItem = await clerk.billing.cancelSubscriptionItem(
        input.subscriptionItemId,
        {
          endNow: false,
        }
      );
      return toPlainClerkResource(canceledItem);
    }),
} satisfies TRPCRouterRecord;
