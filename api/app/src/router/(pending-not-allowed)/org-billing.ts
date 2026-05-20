import type {
  BillingPlan,
  BillingSubscription,
  BillingSubscriptionItem,
} from "@vendor/clerk/server";
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

function toFeatureDto(feature: BillingPlan["features"][number]) {
  return {
    avatarUrl: feature.avatarUrl,
    description: feature.description,
    id: feature.id,
    name: feature.name,
    slug: feature.slug,
  };
}

function toPlanDto(plan: BillingPlan) {
  return {
    annualFee: plan.annualFee,
    annualMonthlyFee: plan.annualMonthlyFee,
    avatarUrl: plan.avatarUrl,
    description: plan.description,
    fee: plan.fee,
    features: plan.features.map(toFeatureDto),
    forPayerType: plan.forPayerType,
    freeTrialDays: plan.freeTrialDays,
    freeTrialEnabled: plan.freeTrialEnabled,
    hasBaseFee: plan.hasBaseFee,
    id: plan.id,
    isDefault: plan.isDefault,
    isRecurring: plan.isRecurring,
    name: plan.name,
    publiclyVisible: plan.publiclyVisible,
    slug: plan.slug,
  };
}

function toSubscriptionItemDto(item: BillingSubscriptionItem) {
  return {
    amount: item.amount ?? null,
    canceledAt: item.canceledAt,
    createdAt: item.createdAt,
    endedAt: item.endedAt,
    id: item.id,
    isFreeTrial: item.isFreeTrial ?? false,
    lifetimePaid: item.lifetimePaid ?? null,
    nextPayment: item.nextPayment ?? null,
    pastDueAt: item.pastDueAt,
    payerId: item.payerId ?? null,
    periodEnd: item.periodEnd,
    periodStart: item.periodStart,
    plan: item.plan ? toPlanDto(item.plan) : null,
    planId: item.planId,
    planPeriod: item.planPeriod,
    status: item.status,
    updatedAt: item.updatedAt,
  };
}

function toSubscriptionDto(subscription: BillingSubscription) {
  return {
    activeAt: subscription.activeAt,
    createdAt: subscription.createdAt,
    eligibleForFreeTrial: subscription.eligibleForFreeTrial,
    id: subscription.id,
    nextPayment: subscription.nextPayment ?? null,
    pastDueAt: subscription.pastDueAt,
    payerId: subscription.payerId,
    status: subscription.status,
    subscriptionItems: subscription.subscriptionItems.map(
      toSubscriptionItemDto
    ),
    updatedAt: subscription.updatedAt,
  };
}

export const orgBillingRouter = {
  overview: pendingNotAllowedProcedure.query(async ({ ctx }) => {
    const clerk = await clerkClient();
    const [plans, subscription, session] = await Promise.all([
      clerk.billing.getPlanList({ limit: 100, payerType: "org" }),
      clerk.billing.getOrganizationBillingSubscription(ctx.auth.identity.orgId),
      auth({ treatPendingAsSignedOut: false }),
    ]);

    return {
      isAdmin:
        !!session.userId &&
        session.orgId === ctx.auth.identity.orgId &&
        session.has({ role: "org:admin" }),
      orgId: ctx.auth.identity.orgId,
      plans: plans.data.map(toPlanDto),
      subscription: toSubscriptionDto(subscription),
    };
  }),

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

      const canceledItem = await clerk.billing.cancelSubscriptionItem(
        input.subscriptionItemId,
        {
          endNow: false,
        }
      );
      return toSubscriptionItemDto(canceledItem);
    }),
} satisfies TRPCRouterRecord;
