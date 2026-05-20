import { cancelOrgBillingSubscriptionItemSchema } from "@repo/app-validation/schemas";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { auth, clerkClient } from "@vendor/clerk/server";

import { pendingNotAllowedProcedure } from "../../trpc";

type BillingTier = "starter" | "team";

interface ClerkBillingMoney {
  amount: number;
  amount_formatted?: string;
  amountFormatted?: string;
  currency: string;
  currency_symbol?: string;
  currencySymbol?: string;
}

interface ClerkBillingFeature {
  avatarUrl?: string | null;
  description?: string | null;
  id: string;
  name: string;
  slug: string;
}

interface ClerkBillingPlan {
  annualFee?: ClerkBillingMoney | null;
  annualMonthlyFee?: ClerkBillingMoney | null;
  avatarUrl?: string | null;
  description?: string | null;
  features?: ClerkBillingFeature[];
  fee?: ClerkBillingMoney | null;
  forPayerType?: "org" | "user";
  freeTrialDays?: number | null;
  freeTrialEnabled?: boolean;
  hasBaseFee?: boolean;
  id: string;
  isDefault?: boolean;
  isRecurring?: boolean;
  name: string;
  publiclyVisible?: boolean;
  slug: string;
}

interface ClerkBillingSubscriptionItem {
  amount?: ClerkBillingMoney | null;
  canceledAt?: number | null;
  createdAt: number;
  endedAt?: number | null;
  id: string;
  isFreeTrial?: boolean;
  lifetimePaid?: ClerkBillingMoney | null;
  nextPayment?: { amount: ClerkBillingMoney | number; date: number } | null;
  pastDueAt?: number | null;
  payerId?: string;
  periodEnd?: number | null;
  periodStart?: number | null;
  plan?: ClerkBillingPlan | null;
  planId?: string | null;
  planPeriod: "month" | "annual";
  status: string;
  updatedAt: number;
}

interface ClerkBillingSubscription {
  activeAt?: number | null;
  createdAt: number;
  eligibleForFreeTrial?: boolean;
  id: string;
  nextPayment?: { amount: ClerkBillingMoney; date: number } | null;
  pastDueAt?: number | null;
  payerId: string;
  status: string;
  subscriptionItems: ClerkBillingSubscriptionItem[];
  updatedAt: number | null;
}

function toMoneyDto(amount?: ClerkBillingMoney | number | null) {
  if (!amount || typeof amount === "number") {
    return null;
  }

  return {
    amount: amount.amount,
    amountFormatted: amount.amountFormatted ?? amount.amount_formatted ?? "",
    currency: amount.currency,
    currencySymbol: amount.currencySymbol ?? amount.currency_symbol ?? "$",
  };
}

function tierForPlan(
  plan?: Pick<ClerkBillingPlan, "isDefault" | "slug"> | null
) {
  if (!plan) {
    return null;
  }
  if (plan.slug === "team") {
    return "team" satisfies BillingTier;
  }
  if (plan.slug === "starter" || plan.slug === "free_org" || plan.isDefault) {
    return "starter" satisfies BillingTier;
  }
  return null;
}

function toPlanDto(plan: ClerkBillingPlan) {
  const tier = tierForPlan(plan);
  if (!tier) {
    return null;
  }

  return {
    amount: toMoneyDto(plan.fee),
    annualAmount: toMoneyDto(plan.annualFee),
    annualMonthlyAmount: toMoneyDto(plan.annualMonthlyFee),
    avatarUrl: plan.avatarUrl ?? null,
    description: plan.description ?? null,
    features: (plan.features ?? []).map((feature) => ({
      avatarUrl: feature.avatarUrl ?? null,
      description: feature.description ?? null,
      id: feature.id,
      name: feature.name,
      slug: feature.slug,
    })),
    forPayerType: plan.forPayerType ?? "org",
    freeTrialDays: plan.freeTrialDays ?? null,
    freeTrialEnabled: plan.freeTrialEnabled ?? false,
    hasBaseFee: plan.hasBaseFee ?? false,
    id: plan.id,
    isDefault: plan.isDefault ?? false,
    isRecurring: plan.isRecurring ?? true,
    name: plan.name,
    publiclyVisible: plan.publiclyVisible ?? true,
    slug: plan.slug,
    tier,
  };
}

function toSubscriptionItemDto(item: ClerkBillingSubscriptionItem) {
  const plan = item.plan ? toPlanDto(item.plan) : null;

  return {
    amount: toMoneyDto(item.amount),
    canceledAt: item.canceledAt ?? null,
    createdAt: item.createdAt,
    endedAt: item.endedAt ?? null,
    id: item.id,
    isFreeTrial: item.isFreeTrial ?? false,
    lifetimePaid: toMoneyDto(item.lifetimePaid),
    nextPayment: item.nextPayment
      ? {
          amount: toMoneyDto(item.nextPayment.amount),
          date: item.nextPayment.date,
        }
      : null,
    pastDueAt: item.pastDueAt ?? null,
    payerId: item.payerId ?? "",
    periodEnd: item.periodEnd ?? null,
    periodStart: item.periodStart ?? null,
    plan,
    planId: item.planId ?? null,
    planPeriod: item.planPeriod,
    status: item.status,
    updatedAt: item.updatedAt,
  };
}

function toSubscriptionDto(subscription: ClerkBillingSubscription) {
  const items = subscription.subscriptionItems.map(toSubscriptionItemDto);
  const activeItems = items.filter((item) =>
    ["active", "past_due"].includes(item.status)
  );
  const currentItem =
    activeItems.find((item) => item.plan?.tier === "team") ??
    activeItems[0] ??
    null;
  const upcomingItem = items.find((item) => item.status === "upcoming") ?? null;

  return {
    activeAt: subscription.activeAt ?? null,
    activeItems,
    createdAt: subscription.createdAt,
    currentItem,
    eligibleForFreeTrial: subscription.eligibleForFreeTrial ?? false,
    id: subscription.id,
    nextPayment: subscription.nextPayment
      ? {
          amount: toMoneyDto(subscription.nextPayment.amount),
          date: subscription.nextPayment.date,
        }
      : null,
    pastDueAt: subscription.pastDueAt ?? null,
    payerId: subscription.payerId,
    status: subscription.status,
    subscriptionItems: items,
    upcomingItem,
    upcomingItems: items.filter((item) => item.status === "upcoming"),
    updatedAt: subscription.updatedAt,
  };
}

export const orgBillingRouter = {
  overview: pendingNotAllowedProcedure.query(async ({ ctx }) => {
    const clerk = await clerkClient();
    const [subscription, plans] = await Promise.all([
      clerk.billing.getOrganizationBillingSubscription(ctx.auth.identity.orgId),
      clerk.billing.getPlanList({
        limit: 100,
        offset: 0,
        payerType: "org",
      }),
    ]);

    return {
      businessContact: {
        email: "sales@lightfast.ai",
        href: "mailto:sales@lightfast.ai",
        label: "Contact Sales",
      },
      plans: plans.data
        .map((plan) => toPlanDto(plan as ClerkBillingPlan))
        .filter((plan) => plan !== null),
      subscription: toSubscriptionDto(subscription as ClerkBillingSubscription),
    };
  }),

  cancelSubscriptionItem: pendingNotAllowedProcedure
    .input(cancelOrgBillingSubscriptionItemSchema)
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
        (await clerk.billing.getOrganizationBillingSubscription(
          ctx.auth.identity.orgId
        )) as ClerkBillingSubscription;
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
