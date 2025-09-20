import { toZonedTime, format } from "date-fns-tz";
import { calculateBillingPeriod } from "@api/chat";
import { MessageType } from "@api/chat/lib/billing/types";
import { createCaller } from "@repo/chat-trpc/server";
import {
  getTRPCErrorCode,
  getTRPCErrorMessage,
  isTRPCClientError,
} from "./errors";

export async function getCurrentPeriod(
  timezone = "UTC",
  userId?: string,
): Promise<string> {
  if (userId) {
    const period: string = await calculateBillingPeriod(userId, timezone);
    return period;
  }

  const now = toZonedTime(new Date(), timezone);
  return format(now, "yyyy-MM");
}

export interface CanSendMessageResult {
  allowed: boolean;
  reason?: string;
  remainingMessages?: number;
  gracePeriod?: {
    active: boolean;
    daysRemaining?: number;
  };
}

export async function canSendMessage({
  messageType,
  timezone,
}: {
  messageType: MessageType;
  timezone?: string;
}): Promise<CanSendMessageResult> {
  try {
    const caller = await createCaller();
    const limitsCheck = await caller.usage.checkLimits({
      timezone: timezone ?? "UTC",
    });

    const exceeded =
      messageType === MessageType.PREMIUM
        ? limitsCheck.exceeded.premiumMessages
        : limitsCheck.exceeded.nonPremiumMessages;

    if (exceeded) {
      const remaining =
        messageType === MessageType.PREMIUM
          ? limitsCheck.remainingQuota.premiumMessages
          : limitsCheck.remainingQuota.nonPremiumMessages;

      let reason =
        messageType === MessageType.PREMIUM
          ? "Premium message limit exceeded for this billing period"
          : "Message limit exceeded for this billing period";

      if (limitsCheck.gracePeriod.active) {
        reason += ` (Grace period: ${limitsCheck.gracePeriod.daysRemaining} days remaining)`;
      }

      return {
        allowed: false,
        reason,
        remainingMessages: remaining,
        gracePeriod: limitsCheck.gracePeriod,
      };
    }

    const remaining =
      messageType === MessageType.PREMIUM
        ? limitsCheck.remainingQuota.premiumMessages
        : limitsCheck.remainingQuota.nonPremiumMessages;

    return {
      allowed: true,
      remainingMessages: remaining,
      gracePeriod: limitsCheck.gracePeriod,
    };
  } catch (error) {
    console.error("[Usage] Error checking message limit:", {
      error: isTRPCClientError(error)
        ? { code: getTRPCErrorCode(error), message: getTRPCErrorMessage(error) }
        : error,
    });

    return {
      allowed: true,
      remainingMessages: 999,
    };
  }
}

export async function trackMessageSent({
  userId,
  messageType,
  timezone,
}: {
  userId: string;
  messageType: MessageType;
  timezone?: string;
}): Promise<void> {
  try {
    const caller = await createCaller();
    const period = await getCurrentPeriod(timezone ?? "UTC", userId);

    if (messageType === MessageType.PREMIUM) {
      await caller.usage.incrementPremium({ period, count: 1 });
    } else {
      await caller.usage.incrementNonPremium({ period, count: 1 });
    }
  } catch (error) {
    console.error("[Usage] Error tracking message usage:", {
      error: isTRPCClientError(error)
        ? { code: getTRPCErrorCode(error), message: getTRPCErrorMessage(error) }
        : error,
    });
  }
}

export class UsageLimitExceededError extends Error {
  public readonly code = "USAGE_LIMIT_EXCEEDED" as const;

  constructor(
    message: string,
    public readonly details: {
      messageType: MessageType;
      remainingMessages: number;
    },
  ) {
    super(message);
    this.name = "UsageLimitExceededError";
  }
}

export async function requireMessageAccess({
  messageType,
  timezone,
}: {
  messageType: MessageType;
  timezone?: string;
}): Promise<void> {
  const result = await canSendMessage({ messageType, timezone });

  if (!result.allowed) {
    throw new UsageLimitExceededError(
      result.reason ?? "Message limit exceeded",
      {
        messageType,
        remainingMessages: result.remainingMessages ?? 0,
      },
    );
  }
}
