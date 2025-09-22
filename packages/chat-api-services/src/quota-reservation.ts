import { MessageType } from "@repo/chat-billing";

import { createCaller } from "@repo/chat-trpc/server";

import { getCurrentPeriod } from "./usage";

export interface QuotaReservation {
  reservationId: string;
  userId: string;
  messageType: MessageType;
  modelId: string;
  period: string;
  reservedAt: Date;
}

export class QuotaReservationError extends Error {
  public readonly code = "QUOTA_RESERVATION_ERROR" as const;

  constructor(
    message: string,
    public readonly details: {
      userId: string;
      messageType: MessageType;
      modelId: string;
      remainingQuota: number;
    },
  ) {
    super(message);
    this.name = "QuotaReservationError";
  }
}

export class QuotaReleaseError extends Error {
  public readonly code = "QUOTA_RELEASE_ERROR" as const;

  constructor(
    message: string,
    public readonly reservationId: string,
    public readonly attempts: number,
    public readonly lastError?: unknown,
  ) {
    super(message);
    this.name = "QuotaReleaseError";
  }
}

export async function reserveQuota({
  userId,
  messageType,
  messageId,
  modelId,
  timezone,
}: {
  userId: string;
  messageType: MessageType;
  messageId: string;
  modelId: string;
  timezone?: string;
}): Promise<QuotaReservation> {
  const caller = await createCaller();
  const period = await getCurrentPeriod(timezone ?? "UTC", userId);

  try {
    const reservation = await caller.usage.reserveQuota({
      modelId,
      messageId,
      messageType: messageType === MessageType.PREMIUM ? "premium" : "standard",
      period,
    });

    return {
      reservationId: reservation.id,
      userId,
      messageType,
      modelId,
      period,
      reservedAt: new Date(),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Quota exceeded")) {
        throw new QuotaReservationError(
          `Quota exceeded for ${messageType} messages`,
          {
            userId,
            messageType,
            modelId,
            remainingQuota: 0,
          },
        );
      }

      if (error.message.includes("Message already processed")) {
        throw new QuotaReservationError("Message already processed", {
          userId,
          messageType,
          modelId,
          remainingQuota: 0,
        });
      }
    }

    console.error("[QuotaReservation] Failed to reserve quota:", error);
    throw error;
  }
}

export async function confirmQuotaUsage(reservationId: string): Promise<void> {
  try {
    const caller = await createCaller();
    await caller.usage.confirmReservation({ reservationId });
  } catch (error) {
    console.error(
      `[QuotaReservation] Failed to confirm reservation ${reservationId}:`,
      error,
    );
    throw error;
  }
}

export async function releaseQuotaReservation(
  reservationId: string,
): Promise<void> {
  const caller = await createCaller();
  const maxAttempts = 3;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    try {
      await caller.usage.releaseReservation({ reservationId });
      return;
    } catch (error) {
      attempt += 1;
      lastError = error;
      console.error(
        `[QuotaReservation] Failed to release reservation ${reservationId} (attempt ${attempt}/${maxAttempts}):`,
        error,
      );
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 200));
      }
    }
  }

  throw new QuotaReleaseError(
    `Failed to release reservation after ${maxAttempts} attempts`,
    reservationId,
    maxAttempts,
    lastError,
  );
}

export async function cleanupExpiredReservations(): Promise<void> {
  try {
    const caller = await createCaller();
    const expiredBefore = new Date(Date.now() - 60 * 60 * 1000);

    await caller.usage.cleanupExpiredReservations({
      expiredBefore: expiredBefore.toISOString(),
    });
  } catch (error) {
    console.error(
      "[QuotaReservation] Failed to cleanup expired reservations:",
      error,
    );
  }
}
