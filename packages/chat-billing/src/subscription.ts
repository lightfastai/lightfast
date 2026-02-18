import type { BillingSubscription, BillingSubscriptionItem } from "@clerk/backend";
import { format, toZonedTime } from "date-fns-tz";
import { isWithinInterval } from "date-fns";

import type { BillingInterval } from "./types";
import { ClerkPlanKey } from "./types";

export interface BillingLogger {
  info?(message: string, metadata?: Record<string, unknown>): void;
  warn?(message: string, metadata?: Record<string, unknown>): void;
  error?(message: string, metadata?: Record<string, unknown>): void;
}

export interface SubscriptionData {
  subscription: BillingSubscription | null;
  paidSubscriptionItems: BillingSubscriptionItem[];
  planKey: ClerkPlanKey;
  hasActiveSubscription: boolean;
  billingInterval: BillingInterval;
  error?: string;
}

export interface DeriveSubscriptionOptions {
  logger?: BillingLogger;
  freePlanIds?: string[];
}

export function deriveSubscriptionData({
  userId,
  subscription,
  options,
}: {
  userId: string;
  subscription: BillingSubscription | null;
  options?: DeriveSubscriptionOptions;
}): SubscriptionData {
  const logger = options?.logger;
  const freePlanIds = options?.freePlanIds ?? ["cplan_free", "free-tier"];

  if (!subscription) {
    logger?.info?.(
      `[Billing] No billing data found for user ${userId}, defaulting to free tier`,
      { userId },
    );

    return {
      subscription: null,
      paidSubscriptionItems: [],
      planKey: ClerkPlanKey.FREE_TIER,
      hasActiveSubscription: false,
      billingInterval: "month",
    };
  }

  const allItems = subscription.subscriptionItems;
  const paidSubscriptionItems = allItems.filter((item) => {
    const planId = item.plan?.id ?? "";
    const planName = item.plan?.name ?? "";
    return !freePlanIds.includes(planId) && !freePlanIds.includes(planName);
  });

  const planKey = paidSubscriptionItems.length > 0 ? ClerkPlanKey.PLUS_TIER : ClerkPlanKey.FREE_TIER;
  const billingInterval: BillingInterval =
    paidSubscriptionItems[0]?.planPeriod === "annual" ? "annual" : "month";

  if (paidSubscriptionItems.length > 0) {
    logger?.info?.(`[Billing] User ${userId} has plus plan`, {
      userId,
      paidItems: paidSubscriptionItems.length,
      planPeriod: paidSubscriptionItems[0]?.planPeriod,
    });
  } else {
    logger?.info?.(`[Billing] User ${userId} has free plan`, { userId });
  }

  let hasActiveSubscription = false;
  if (typeof subscription.status === "string") {
    hasActiveSubscription = subscription.status === "active" && paidSubscriptionItems.length > 0;
  } else {
    logger?.warn?.("[Billing] Unexpected subscription status format", {
      userId,
      statusType: typeof subscription.status,
    });
  }

  return {
    subscription,
    paidSubscriptionItems,
    planKey,
    hasActiveSubscription,
    billingInterval,
  };
}

export interface BillingSubscriptionFetcher {
  getUserBillingSubscription(userId: string): Promise<BillingSubscription>;
}

export async function fetchSubscriptionData(
  userId: string,
  fetcher: BillingSubscriptionFetcher,
  options?: DeriveSubscriptionOptions,
): Promise<SubscriptionData> {
  try {
    const subscription = await fetcher.getUserBillingSubscription(userId);
    return deriveSubscriptionData({ userId, subscription, options });
  } catch (error) {
    const logger = options?.logger;
    const message = error instanceof Error ? error.message : "Unknown error";
    logger?.error?.(`[Billing] Failed to fetch subscription for user ${userId}`, {
      userId,
      error: message,
    });

    return {
      subscription: null,
      paidSubscriptionItems: [],
      planKey: ClerkPlanKey.FREE_TIER,
      hasActiveSubscription: false,
      billingInterval: "month",
      error: `Clerk API error: ${message}`,
    };
  }
}

export interface CalculateBillingPeriodOptions {
  timezone?: string;
  now?: Date;
  logger?: BillingLogger;
}

export function calculateBillingPeriodFromSubscription(
  userId: string,
  subscriptionData: SubscriptionData,
  options: CalculateBillingPeriodOptions = {},
): string {
  const { timezone = "UTC", now = new Date(), logger } = options;
  const zonedNow = toZonedTime(now, timezone);

  if (!subscriptionData.subscription || !subscriptionData.hasActiveSubscription) {
    return format(zonedNow, "yyyy-MM");
  }

  const activePaidItem = subscriptionData.paidSubscriptionItems.find((item) =>
    Boolean(item.periodStart && item.periodEnd),
  );

  if (activePaidItem?.periodStart && activePaidItem.periodEnd) {
    const periodStart = toZonedTime(new Date(activePaidItem.periodStart), timezone);
    const periodEnd = toZonedTime(new Date(activePaidItem.periodEnd), timezone);

    if (isWithinInterval(zonedNow, { start: periodStart, end: periodEnd })) {
      const billingPeriodId = format(periodStart, "yyyy-MM-dd");
      logger?.info?.(`[Billing] User ${userId} in billing period ${billingPeriodId}`, {
        userId,
        billingPeriodId,
        planPeriod: activePaidItem.planPeriod,
      });
      return billingPeriodId;
    }
  }

  return format(zonedNow, "yyyy-MM");
}

export async function calculateBillingPeriodForUser(
  params: {
    userId: string;
    timezone?: string;
    fetcher: BillingSubscriptionFetcher;
    logger?: BillingLogger;
    now?: Date;
    freePlanIds?: string[];
  },
): Promise<string> {
  const { userId, timezone, fetcher, logger, now, freePlanIds } = params;
  const subscriptionData = await fetchSubscriptionData(userId, fetcher, {
    logger,
    freePlanIds,
  });

  return calculateBillingPeriodFromSubscription(userId, subscriptionData, {
    timezone,
    now,
    logger,
  });
}
