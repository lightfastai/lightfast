import type { BillingPlan } from "@vendor/clerk/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { auth, clerkClient } from "@vendor/clerk/server";
import { z } from "zod";

import { pendingNotAllowedProcedure } from "../../trpc";

function tierForPlan(plan?: Pick<BillingPlan, "isDefault" | "slug"> | null) {
  if (!plan) {
    return null;
  }
  if (plan.slug === "team") {
    return "team";
  }
  if (plan.slug === "starter" || plan.slug === "free_org" || plan.isDefault) {
    return "starter";
  }
  return null;
}

export const orgBillingRouter = {
  cancelSubscriptionItem: pendingNotAllowedProcedure
    .input(
      z.object({
        subscriptionItemId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await auth({ treatPendingAsSignedOut: false });
      if (
        !session.userId ||
        session.orgId !== ctx.auth.identity.orgId ||
        !session.has({ role: "org:admin" })
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can perform this action",
        });
      }

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
      if (tierForPlan(item.plan) !== "team") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only the Team plan can be canceled",
        });
      }

      await clerk.billing.cancelSubscriptionItem(input.subscriptionItemId, {
        endNow: false,
      });
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
