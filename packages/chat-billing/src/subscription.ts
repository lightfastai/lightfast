import type { BillingSubscription, BillingSubscriptionItem } from "@clerk/backend";
import { format, toZonedTime } from "date-fns-tz";
import { isWithinInterval } from "date-fns";

import type { BillingInterval } from "./types";
import { ClerkPlanKey, getClerkPlanId } from "./types";

export interface SubscriptionState {
  planKey: ClerkPlanKey;
  hasActiveSubscription: boolean;
  activePaidItem: BillingSubscriptionItem | null;
  paidSubscriptionItems: BillingSubscriptionItem[];
  billingInterval: BillingInterval;
}

/**
 * Derive billing state from a raw Clerk subscription.
 * Pure function — no fetching, no logging, no side effects.
 */
export function getSubscriptionState(
  subscription: BillingSubscription | null,
): SubscriptionState {
  const freePlanId = getClerkPlanId(ClerkPlanKey.FREE_TIER);

  if (!subscription) {
    return {
      planKey: ClerkPlanKey.FREE_TIER,
      hasActiveSubscription: false,
      activePaidItem: null,
      paidSubscriptionItems: [],
      billingInterval: "month",
    };
  }

  const paidSubscriptionItems = subscription.subscriptionItems.filter(
    (item) => item.plan?.id !== freePlanId,
  );

  // During plan transitions Clerk keeps multiple items (e.g. old "canceled"
  // + new "upcoming"). Use the active item for state derivation.
  const activePaidItem =
    paidSubscriptionItems.find((item) => item.status === "active") ?? null;

  const planKey =
    paidSubscriptionItems.length > 0
      ? ClerkPlanKey.PLUS_TIER
      : ClerkPlanKey.FREE_TIER;

  const hasActiveSubscription =
    subscription.status === "active" && activePaidItem != null;

  const billingInterval: BillingInterval =
    (activePaidItem ?? paidSubscriptionItems[0])?.planPeriod === "annual"
      ? "annual"
      : "month";

  return {
    planKey,
    hasActiveSubscription,
    activePaidItem,
    paidSubscriptionItems,
    billingInterval,
  };
}

/**
 * Calculate the billing period identifier for a subscription.
 * Returns "YYYY-MM-DD" for active paid subscriptions (based on period start),
 * or "YYYY-MM" for free/inactive users.
 */
export function calculateBillingPeriodFromSubscription(
  subscription: BillingSubscription | null,
  options: { timezone?: string; now?: Date } = {},
): string {
  const { timezone = "UTC", now = new Date() } = options;
  const zonedNow = toZonedTime(now, timezone);

  if (!subscription) {
    return format(zonedNow, "yyyy-MM");
  }

  const { hasActiveSubscription, paidSubscriptionItems } =
    getSubscriptionState(subscription);

  if (!hasActiveSubscription) {
    return format(zonedNow, "yyyy-MM");
  }

  const activePaidItem = paidSubscriptionItems.find((item) =>
    Boolean(item.periodStart && item.periodEnd),
  );

  if (activePaidItem?.periodStart && activePaidItem.periodEnd) {
    const periodStart = toZonedTime(
      new Date(activePaidItem.periodStart),
      timezone,
    );
    const periodEnd = toZonedTime(
      new Date(activePaidItem.periodEnd),
      timezone,
    );

    if (isWithinInterval(zonedNow, { start: periodStart, end: periodEnd })) {
      return format(periodStart, "yyyy-MM-dd");
    }
  }

  return format(zonedNow, "yyyy-MM");
}
